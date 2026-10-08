import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";

const DATA_KEY = "@vyapar_khata_data_v3";
const BACKUP_KEY = "@vyapar_khata_backup_v3";
const PIN_KEY = "@vyapar_khata_pin_v3";

const EMPTY_DATA = {
  business: {
    name: "Vyapar Khata",
    phone: "",
    address: "",
    gst: "",
  },
  customers: [],
  suppliers: [],
  transactions: [],
  expenses: [],
};

const money = (n) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN");

const num = (v) => {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const today = () => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    d.getFullYear()
  );
};

const uid = (p) =>
  p + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);

function titleFor(type) {
  if (type === "received") return "Payment Received";
  if (type === "given") return "Payment Given";
  if (type === "sale") return "Credit / Sale";
  if (type === "purchase") return "Purchase";
  return "Transaction";
}

function inputValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function normalizeData(x) {
  return {
    ...EMPTY_DATA,
    ...(x || {}),
    business: {
      ...EMPTY_DATA.business,
      ...((x && x.business) || {}),
    },
    customers: Array.isArray(x?.customers) ? x.customers : [],
    suppliers: Array.isArray(x?.suppliers) ? x.suppliers : [],
    transactions: Array.isArray(x?.transactions)
      ? x.transactions
      : [],
    expenses: Array.isArray(x?.expenses)
      ? x.expenses
      : [],
  };
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const dataRef = useRef(EMPTY_DATA);

  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("home");
  const [tab, setTab] = useState("customers");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [form, setForm] = useState({});
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [locked, setLocked] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [primary, backup, storedPin] =
        await Promise.all([
          AsyncStorage.getItem(DATA_KEY),
          AsyncStorage.getItem(BACKUP_KEY),
          AsyncStorage.getItem(PIN_KEY),
        ]);

      let loaded = null;
      let backupData = null;

      try {
        if (primary) {
          loaded = normalizeData(JSON.parse(primary));
        }
      } catch (e) {
        console.log("Primary data error:", e);
      }

      try {
        if (backup) {
          backupData = normalizeData(JSON.parse(backup));
        }
      } catch (e) {
        console.log("Backup data error:", e);
      }

      const primaryHasData =
        loaded &&
        (
          loaded.customers.length > 0 ||
          loaded.suppliers.length > 0 ||
          loaded.transactions.length > 0 ||
          loaded.expenses.length > 0
        );

      if (!primaryHasData && backupData) {
        loaded = backupData;
      }

      const finalData = loaded || EMPTY_DATA;

      dataRef.current = finalData;
      setData(finalData);

      if (storedPin) {
        setSavedPin(storedPin);
        setLocked(true);
      }
    } catch (e) {
      console.log("Load error:", e);
    }

    setReady(true);
  }

  async function persist(next) {
    const json = JSON.stringify(next);

    try {
      await AsyncStorage.multiSet([
        [DATA_KEY, json],
        [BACKUP_KEY, json],
      ]);
    } catch (e) {
      console.log("Save error:", e);
    }
  }

  function updateData(updater) {
    const next =
      typeof updater === "function"
        ? updater(dataRef.current)
        : updater;

    dataRef.current = next;
    setData(next);
    persist(next);
  }

  function balance(party) {
    let b = num(party.openingBalance);

    if (party.balanceType === "advance") {
      b = -b;
    }

    data.transactions.forEach((t) => {
      if (
        t.partyId !== party.id ||
        t.partyType !== party.type
      ) {
        return;
      }

      if (party.type === "customer") {
        if (t.type === "sale") b += num(t.amount);
        if (t.type === "received") b -= num(t.amount);
        if (t.type === "given") b += num(t.amount);
      }

      if (party.type === "supplier") {
        if (t.type === "purchase") b += num(t.amount);
        if (t.type === "given") b -= num(t.amount);
        if (t.type === "received") b += num(t.amount);
      }
    });

    return b;
  }

  const customers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return data.customers;

    return data.customers.filter(
      (x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.customers, search]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return data.suppliers;

    return data.suppliers.filter(
      (x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.suppliers, search]);

  const receivable = data.customers.reduce(
    (s, p) =>
      s +
      Math.max(
        balance({
          ...p,
          type: "customer",
        }),
        0
      ),
    0
  );

  const payable = data.suppliers.reduce(
    (s, p) =>
      s +
      Math.max(
        balance({
          ...p,
          type: "supplier",
        }),
        0
      ),
    0
  );

  const received = data.transactions
    .filter((x) => x.type === "received")
    .reduce((s, x) => s + num(x.amount), 0);

  const given = data.transactions
    .filter((x) => x.type === "given")
    .reduce((s, x) => s + num(x.amount), 0);

  const sales = data.transactions
    .filter((x) => x.type === "sale")
    .reduce((s, x) => s + num(x.amount), 0);

  const purchases = data.transactions
    .filter((x) => x.type === "purchase")
    .reduce((s, x) => s + num(x.amount), 0);

  const expenses = data.expenses.reduce(
    (s, x) => s + num(x.amount),
    0
  );

  /*
   * -------------------------------------------------------
   * PARTY
   * -------------------------------------------------------
   */

  function openParty(type, party = null) {
    setForm(
      party
        ? {
            ...party,
            type,
          }
        : {
            name: "",
            phone: "",
            address: "",
            gst: "",
            email: "",
            openingBalance: "",
            balanceType: "due",
            type,
          }
    );

    setModal(
      party
        ? "editParty"
        : type === "customer"
        ? "customer"
        : "supplier"
    );

    /*
     * NEW:
     * New Customer/Supplier open karte hi
     * native phone Contacts picker automatically open.
     *
     * Existing party edit karte waqt picker nahi khulega.
     */
    if (!party) {
      setTimeout(() => {
        pickContact();
      }, 450);
    }
  }

  /*
   * -------------------------------------------------------
   * CONTACT PICKER
   * -------------------------------------------------------
   */

  async function pickContact() {
    if (contactLoading) return;

    try {
      setContactLoading(true);

      const permission =
        await Contacts.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Contacts Permission",
          "Contacts permission allow karein. Aap baad mein manually details bhi enter kar sakte hain."
        );
        return;
      }

      const result =
        await Contacts.presentContactPickerAsync();

      if (!result) return;

      /*
       * Expo Contacts versions mein result direct Contact
       * ya { contact: Contact } dono ho sakte hain.
       */
      const contact = result.contact || result;

      if (!contact) return;

      const phone =
        contact.phoneNumbers?.[0]?.number || "";

      const email =
        contact.emails?.[0]?.email || "";

      const address =
        contact.addresses?.[0]
          ? [
              contact.addresses[0].street,
              contact.addresses[0].city,
              contact.addresses[0].region,
              contact.addresses[0].postalCode,
            ]
              .filter(Boolean)
              .join(", ")
          : "";

      const fullName = [
        contact.firstName,
        contact.middleName,
        contact.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const name =
        contact.name ||
        fullName ||
        contact.firstName ||
        "";

      setForm((old) => ({
        ...old,
        name: name || old.name || "",
        phone: phone || old.phone || "",
        email: email || old.email || "",
        address: address || old.address || "",
      }));
    } catch (e) {
      console.log("Contact picker error:", e);

      Alert.alert(
        "Contacts",
        "Contact select nahi ho saka. Aap details manually enter kar sakte hain."
      );
    } finally {
      setContactLoading(false);
    }
  }

  function saveParty() {
    if (!String(form.name || "").trim()) {
      Alert.alert(
        "Required",
        "Name enter karein."
      );
      return;
    }

    const type =
      form.type ||
      (modal === "supplier"
        ? "supplier"
        : "customer");

    const party = {
      id: form.id || uid(type),
      type,
      name: String(form.name).trim(),
      phone: inputValue(form.phone),
      address: inputValue(form.address),
      gst: inputValue(form.gst),
      email: inputValue(form.email),
      openingBalance: num(form.openingBalance),
      balanceType: form.balanceType || "due",
    };

    updateData((old) => {
      const key =
        type === "customer"
          ? "customers"
          : "suppliers";

      if (form.id) {
        return {
          ...old,
          [key]: old[key].map((x) =>
            x.id === form.id ? party : x
          ),
        };
      }

      return {
        ...old,
        [key]: [...old[key], party],
      };
    });

    setModal("");
    setForm({});

    Alert.alert(
      "Saved",
      `${
        type === "customer"
          ? "Customer"
          : "Supplier"
      } saved successfully.`
    );
  }

  function deleteParty(party) {
    Alert.alert(
      "Delete",
      `Delete ${party.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const key =
              party.type === "supplier"
                ? "suppliers"
                : "customers";

            updateData((old) => ({
              ...old,
              [key]: old[key].filter(
                (x) => x.id !== party.id
              ),
              transactions:
                old.transactions.filter(
                  (x) =>
                    !(
                      x.partyId === party.id &&
                      x.partyType === party.type
                    )
                ),
            }));

            setSelected(null);
            setPage("home");
          },
        },
      ]
    );
  }

  function openPartyDetails(party, type) {
    setSelected({
      ...party,
      type,
    });

    setPage("party");
  }

  /*
   * -------------------------------------------------------
   * PAYMENTS
   * -------------------------------------------------------
   */

  function openPayment(type, party) {
    setSelected({
      ...party,
      type: party.type || tab.slice(0, -1),
    });

    setForm({
      amount: "",
      paymentMode: "Cash",
      reference: "",
      note: "",
      date: today(),
    });

    setModal(type);
  }

  function savePayment() {
    const amount = num(form.amount);

    if (!amount || amount <= 0) {
      Alert.alert(
        "Amount",
        "Valid amount enter karein."
      );
      return;
    }

    if (!selected) return;

    const transaction = {
      id: uid("tx"),
      partyId: selected.id,
      partyType: selected.type,
      partyName: selected.name,
      type: modal,
      amount,
      paymentMode:
        form.paymentMode || "Cash",
      reference: inputValue(form.reference),
      note: inputValue(form.note),
      date: form.date || today(),
      createdAt: Date.now(),
    };

    updateData((old) => ({
      ...old,
      transactions: [
        transaction,
        ...old.transactions,
      ],
    }));

    setModal("");

    Alert.alert(
      "Payment Saved",
      `${titleFor(modal)} successfully saved.`
    );
  }

  /*
   * -------------------------------------------------------
   * SALE / PURCHASE
   * -------------------------------------------------------
   */

  function openSalePurchase(type) {
    if (!selected) return;

    setForm({
      amount: "",
      note: "",
      paymentMode: "Credit",
      reference: "",
      date: today(),
    });

    setModal(type);
  }

  function saveSalePurchase() {
    const amount = num(form.amount);

    if (!amount || amount <= 0) {
      Alert.alert(
        "Amount",
        "Valid amount enter karein."
      );
      return;
    }

    if (!selected) return;

    const tx = {
      id: uid("tx"),
      partyId: selected.id,
      partyType: selected.type,
      partyName: selected.name,
      type: modal,
      amount,
      paymentMode:
        form.paymentMode || "Credit",
      reference: inputValue(form.reference),
      note: inputValue(form.note),
      date: form.date || today(),
      createdAt: Date.now(),
    };

    updateData((old) => ({
      ...old,
      transactions: [
        tx,
        ...old.transactions,
      ],
    }));

    setModal("");

    Alert.alert(
      "Saved",
      `${titleFor(modal)} successfully saved.`
    );
  }

  /*
   * -------------------------------------------------------
   * EXPENSE
   * -------------------------------------------------------
   */

  function openExpense() {
    setForm({
      title: "",
      amount: "",
      note: "",
      paymentMode: "Cash",
      date: today(),
    });

    setModal("expense");
  }

  function saveExpense() {
    const amount = num(form.amount);

    if (!String(form.title || "").trim()) {
      Alert.alert(
        "Required",
        "Expense name enter karein."
      );
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert(
        "Amount",
        "Valid amount enter karein."
      );
      return;
    }

    const expense = {
      id: uid("expense"),
      title: String(form.title).trim(),
      amount,
      note: inputValue(form.note),
      paymentMode:
        form.paymentMode || "Cash",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    updateData((old) => ({
      ...old,
      expenses: [
        expense,
        ...old.expenses,
      ],
    }));

    setModal("");

    Alert.alert(
      "Expense Saved",
      "Expense successfully saved."
    );
  }

  /*
   * -------------------------------------------------------
   * BUSINESS
   * -------------------------------------------------------
   */

  function openBusiness() {
    setForm({
      ...data.business,
    });

    setModal("business");
  }

  function saveBusiness() {
    updateData((old) => ({
      ...old,
      business: {
        name:
          String(form.name || "").trim() ||
          "Vyapar Khata",
        phone: inputValue(form.phone),
        address: inputValue(form.address),
        gst: inputValue(form.gst),
      },
    }));

    setModal("");
  }

  /*
   * -------------------------------------------------------
   * CALL / WHATSAPP
   * -------------------------------------------------------
   */

  async function callParty() {
    if (!selected?.phone) {
      Alert.alert(
        "Phone",
        "Phone number available nahi hai."
      );
      return;
    }

    const phone = String(
      selected.phone
    ).replace(/[^0-9+]/g, "");

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert(
        "Error",
        "Phone app open nahi ho saka."
      );
    }
  }

  async function whatsappParty() {
    if (!selected?.phone) {
      Alert.alert(
        "WhatsApp",
        "Phone number available nahi hai."
      );
      return;
    }

    const balanceAmount =
      balance(selected);

    const message =
      `Namaste ${selected.name},\n\n` +
      `${data.business.name}\n` +
      `Your current balance: ${money(
        Math.abs(balanceAmount)
      )}\n\n` +
      `Thank you.`;

    let phone = String(
      selected.phone
    ).replace(/[^0-9]/g, "");

    if (phone.length === 10) {
      phone = "91" + phone;
    }

    const url =
      `https://wa.me/${phone}?text=` +
      encodeURIComponent(message);

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "WhatsApp",
        "WhatsApp open nahi ho saka."
      );
    }
  }

  /*
   * -------------------------------------------------------
   * PIN
   * -------------------------------------------------------
   */

  function setPinForApp() {
    setForm({
      newPin: "",
    });

    setModal("setPin");
  }

  async function savePin() {
    const newPin =
      String(form.newPin || "").trim();

    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert(
        "PIN",
        "4 se 6 digit ka PIN enter karein."
      );
      return;
    }

    try {
      await AsyncStorage.setItem(
        PIN_KEY,
        newPin
      );

      setSavedPin(newPin);
      setLocked(false);
      setPin("");
      setModal("");

      Alert.alert(
        "PIN Saved",
        "App PIN successfully set."
      );
    } catch {
      Alert.alert(
        "Error",
        "PIN save nahi ho saka."
      );
    }
  }

  function unlock() {
    if (pin === savedPin) {
      setLocked(false);
      setPin("");
    } else {
      Alert.alert(
        "Wrong PIN",
        "PIN incorrect hai."
      );
    }
  }

  function removePin() {
    Alert.alert(
      "Remove PIN",
      "App PIN remove karna hai?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(
              PIN_KEY
            );

            setSavedPin("");
            setLocked(false);
          },
        },
      ]
    );
  }

  /*
   * -------------------------------------------------------
   * HOME
   * -------------------------------------------------------
   */

  function renderHome() {
    const list =
      tab === "customers"
        ? customers
        : suppliers;

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Business Dashboard
            </Text>

            <Text style={styles.brand}>
              {data.business.name}
            </Text>

            <Text style={styles.subBrand}>
              Smart Business Ledger
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openBusiness}
          >
            <Text style={styles.settingsText}>
              ⚙️
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>
            Today's Overview
          </Text>

          <Text style={styles.overviewSub}>
            Manage your business money in one place
          </Text>

          <View style={styles.overviewRow}>
            <View>
              <Text style={styles.overviewLabel}>
                Received
              </Text>

              <Text style={styles.overviewGreen}>
                {money(received)}
              </Text>
            </View>

            <View>
              <Text style={styles.overviewLabel}>
                Given
              </Text>

              <Text style={styles.overviewRed}>
                {money(given)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <Summary
            title="Receivable"
            value={money(receivable)}
            type="red"
            icon="↓"
          />

          <Summary
            title="Payable"
            value={money(payable)}
            type="orange"
            icon="↑"
          />

          <Summary
            title="Sales"
            value={money(sales)}
            type="green"
            icon="₹"
          />

          <Summary
            title="Purchases"
            value={money(purchases)}
            type="blue"
            icon="🛒"
          />
        </View>

        <Text style={styles.quickTitle}>
          Quick Actions
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              openParty("customer")
            }
          >
            <Text style={styles.actionIcon}>
              👤
            </Text>

            <Text style={styles.primaryButtonText}>
              Customer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              openParty("supplier")
            }
          >
            <Text style={styles.actionIcon}>
              🏪
            </Text>

            <Text style={styles.secondaryButtonText}>
              Supplier
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.expenseButton}
          onPress={openExpense}
        >
          <Text style={styles.expenseIcon}>
            💸
          </Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.expenseButtonText}>
              Add Expense
            </Text>

            <Text style={styles.expenseSub}>
              Record business expense
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Parties
          </Text>

          <Text style={styles.countText}>
            {tab === "customers"
              ? data.customers.length
              : data.suppliers.length}{" "}
            total
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === "customers" &&
                styles.activeTab,
            ]}
            onPress={() =>
              setTab("customers")
            }
          >
            <Text
              style={[
                styles.tabText,
                tab === "customers" &&
                  styles.activeTabText,
              ]}
            >
              Customers
            </Text>

            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {data.customers.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              tab === "suppliers" &&
                styles.activeTab,
            ]}
            onPress={() =>
              setTab("suppliers")
            }
          >
            <Text
              style={[
                styles.tabText,
                tab === "suppliers" &&
                  styles.activeTabText,
              ]}
            >
              Suppliers
            </Text>

            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {data.suppliers.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          placeholder="🔎  Search name or phone"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#98A2B3"
        />

        {list.map((party) => {
          const type =
            tab === "customers"
              ? "customer"
              : "supplier";

          const b = balance({
            ...party,
            type,
          });

          return (
            <TouchableOpacity
              key={party.id}
              style={styles.partyCard}
              onPress={() =>
                openPartyDetails(
                  party,
                  type
                )
              }
              activeOpacity={0.8}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(party.name || "?")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.partyInfo}>
                <Text
                  style={styles.partyName}
                  numberOfLines={1}
                >
                  {party.name}
                </Text>

                <Text style={styles.partyPhone}>
                  {party.phone ||
                    "No phone number"}
                </Text>
              </View>

              <View style={styles.balanceBox}>
                <Text
                  style={[
                    styles.balanceStatus,
                    b > 0
                      ? styles.red
                      : b < 0
                      ? styles.green
                      : styles.gray,
                  ]}
                >
                  {b > 0
                    ? "Due"
                    : b < 0
                    ? "Advance"
                    : "Clear"}
                </Text>

                <Text
                  style={[
                    styles.partyBalance,
                    b > 0
                      ? styles.red
                      : b < 0
                      ? styles.green
                      : styles.gray,
                  ]}
                >
                  {money(Math.abs(b))}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {list.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyIcon}>
                👥
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No {tab} yet
            </Text>

            <Text style={styles.emptyText}>
              Add a party from your phone contacts
              and start maintaining the ledger.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() =>
                openParty(
                  tab === "customers"
                    ? "customer"
                    : "supplier"
                )
              }
            >
              <Text style={styles.emptyButtonText}>
                + Add{" "}
                {tab === "customers"
                  ? "Customer"
                  : "Supplier"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>
              Cash Summary
            </Text>

            <Text style={styles.statsIcon}>
              💰
            </Text>
          </View>

          <StatRow
            title="Received"
            value={money(received)}
            positive
          />

          <StatRow
            title="Given"
            value={money(given)}
          />

          <StatRow
            title="Expenses"
            value={money(expenses)}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Recent Transactions
          </Text>

          <Text style={styles.countText}>
            Latest 10
          </Text>
        </View>

        {data.transactions
          .slice(0, 10)
          .map((t) => (
            <View
              key={t.id}
              style={styles.transactionCard}
            >
              <View style={styles.txIcon}>
                <Text>
                  {t.type === "received"
                    ? "↓"
                    : t.type === "given"
                    ? "↑"
                    : t.type === "sale"
                    ? "🧾"
                    : "🛒"}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  marginLeft: 11,
                }}
              >
                <Text
                  style={styles.transactionName}
                  numberOfLines={1}
                >
                  {t.partyName}
                </Text>

                <Text style={styles.transactionType}>
                  {titleFor(t.type)}
                  {t.paymentMode
                    ? ` • ${t.paymentMode}`
                    : ""}
                </Text>

                <Text style={styles.transactionDate}>
                  {t.date}
                </Text>
              </View>

              <Text
                style={[
                  styles.transactionAmount,
                  t.type === "received"
                    ? styles.greenText
                    : t.type === "sale"
                    ? styles.blueText
                    : styles.redText,
                ]}
              >
                {money(t.amount)}
              </Text>
            </View>
          ))}

        {data.transactions.length === 0 && (
          <View style={styles.smallEmpty}>
            <Text style={styles.emptyText}>
              No transactions yet.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  /*
   * -------------------------------------------------------
   * PARTY DETAILS
   * -------------------------------------------------------
   */

  function renderParty() {
    if (!selected) return null;

    const b = balance(selected);

    const transactions =
      data.transactions.filter(
        (t) =>
          t.partyId === selected.id &&
          t.partyType === selected.type
      );

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setPage("home");
            setSelected(null);
          }}
        >
          <Text style={styles.backText}>
            ← Back to Parties
          </Text>
        </TouchableOpacity>

        <View style={styles.profileCard}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>
              {(selected.name || "?")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {selected.name}
          </Text>

          <Text style={styles.profilePhone}>
            {selected.phone ||
              "No phone number"}
          </Text>

          {selected.email ? (
            <Text style={styles.profileDetail}>
              ✉ {selected.email}
            </Text>
          ) : null}

          {selected.address ? (
            <Text style={styles.profileDetail}>
              📍 {selected.address}
            </Text>
          ) : null}

          {selected.gst ? (
            <Text style={styles.profileDetail}>
              GST: {selected.gst}
            </Text>
          ) : null}

          <View style={styles.balanceDivider} />

          <Text style={styles.balanceCaption}>
            Current Balance
          </Text>

          <Text
            style={[
              styles.bigBalance,
              b > 0
                ? styles.red
                : b < 0
                ? styles.green
                : styles.gray,
            ]}
          >
            {money(Math.abs(b))}
          </Text>

          <Text
            style={[
              styles.balanceWord,
              b > 0
                ? styles.red
                : b < 0
                ? styles.green
                : styles.gray,
            ]}
          >
            {b > 0
              ? "Amount Due"
              : b < 0
              ? "Advance"
              : "Account Clear"}
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.receiveButton}
            onPress={() =>
              openPayment(
                "received",
                selected
              )
            }
          >
            <Text style={styles.actionButtonIcon}>
              ↓
            </Text>
            <Text style={styles.actionButtonText}>
              Received
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.giveButton}
            onPress={() =>
              openPayment(
                "given",
                selected
              )
            }
          >
            <Text style={styles.actionButtonIcon}>
              ↑
            </Text>
            <Text style={styles.actionButtonText}>
              Given
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.normalAction}
            onPress={() =>
              openSalePurchase(
                selected.type ===
                  "customer"
                  ? "sale"
                  : "purchase"
              )
            }
          >
            <Text style={styles.normalActionIcon}>
              🧾
            </Text>

            <Text style={styles.normalActionText}>
              {selected.type ===
              "customer"
                ? "Sale"
                : "Purchase"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.normalAction}
            onPress={() =>
              openParty(
                selected.type,
                selected
              )
            }
          >
            <Text style={styles.normalActionIcon}>
              ✏️
            </Text>

            <Text style={styles.normalActionText}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={callParty}
          >
            <Text style={styles.contactText}>
              📞 Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={whatsappParty}
          >
            <Text style={styles.contactText}>
              💬 WhatsApp
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Ledger
        </Text>

        {transactions.map((t) => (
          <View
            key={t.id}
            style={styles.transactionCard}
          >
            <View style={styles.txIcon}>
              <Text>
                {t.type === "received"
                  ? "↓"
                  : t.type === "given"
                  ? "↑"
                  : t.type === "sale"
                  ? "🧾"
                  : "🛒"}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 11,
              }}
            >
              <Text
                style={styles.transactionName}
              >
                {titleFor(t.type)}
              </Text>

              <Text
                style={styles.transactionType}
              >
                {t.note ||
                  t.paymentMode ||
                  "Transaction"}
              </Text>

              <Text
                style={styles.transactionDate}
              >
                {t.date}
                {t.reference
                  ? ` • Ref: ${t.reference}`
                  : ""}
              </Text>
            </View>

            <Text
              style={[
                styles.transactionAmount,
                t.type === "received"
                  ? styles.greenText
                  : styles.redText,
              ]}
            >
              {money(t.amount)}
            </Text>
          </View>
        ))}

        {transactions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              📒
            </Text>

            <Text style={styles.emptyTitle}>
              No transactions
            </Text>

            <Text style={styles.emptyText}>
              Payment, sale or purchase add karein.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() =>
            deleteParty(selected)
          }
        >
          <Text style={styles.deleteText}>
            Delete Party
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /*
   * -------------------------------------------------------
   * MODALS
   * -------------------------------------------------------
   */

  function renderModal() {
    if (!modal) return null;

    const partyModal =
      modal === "customer" ||
      modal === "supplier" ||
      modal === "editParty";

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModal("")
        }
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <View style={styles.modalBox}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingBottom: 30,
              }}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {modal === "customer"
                      ? "Add Customer"
                      : modal === "supplier"
                      ? "Add Supplier"
                      : modal === "editParty"
                      ? "Edit Party"
                      : modal === "received"
                      ? "Payment Received"
                      : modal === "given"
                      ? "Payment Given"
                      : modal === "sale"
                      ? "Credit / Sale"
                      : modal === "purchase"
                      ? "Purchase"
                      : modal === "expense"
                      ? "Add Expense"
                      : modal === "business"
                      ? "Business Profile"
                      : "Set App PIN"}
                  </Text>

                  {partyModal &&
                  !form.id ? (
                    <Text style={styles.modalSub}>
                      Contact se details automatically fill karein
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setModal("")
                  }
                  style={styles.closeButton}
                >
                  <Text style={styles.closeText}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {partyModal && (
                <>
                  {!form.id && (
                    <TouchableOpacity
                      style={
                        styles.contactPickerButton
                      }
                      onPress={pickContact}
                      disabled={
                        contactLoading
                      }
                    >
                      {contactLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <View
                            style={
                              styles.contactPickerCircle
                            }
                          >
                            <Text>
                              📱
                            </Text>
                          </View>

                          <View
                            style={{
                              flex: 1,
                            }}
                          >
                            <Text
                              style={
                                styles.contactPickerTitle
                              }
                            >
                              Choose from Contacts
                            </Text>

                            <Text
                              style={
                                styles.contactPickerSub
                              }
                            >
                              Name, phone & address auto-fill
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.contactPickerArrow
                            }
                          >
                            ›
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <Field
                    label="Name"
                    value={form.name}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        name: v,
                      })
                    }
                    placeholder="Party name"
                  />

                  <Field
                    label="Phone"
                    value={form.phone}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        phone: v,
                      })
                    }
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />

                  <Field
                    label="Email"
                    value={form.email}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        email: v,
                      })
                    }
                    placeholder="Email"
                    keyboardType="email-address"
                  />

                  <Field
                    label="Address"
                    value={form.address}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        address: v,
                      })
                    }
                    placeholder="Address"
                  />

                  <Field
                    label="GST"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        gst: v,
                      })
                    }
                    placeholder="GST number"
                  />

                  <Field
                    label="Opening Balance"
                    value={inputValue(
                      form.openingBalance
                    )}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        openingBalance: v,
                      })
                    }
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Text style={styles.fieldLabel}>
                    Balance Type
                  </Text>

                  <View
                    style={styles.choiceRow}
                  >
                    <Choice
                      title="Due"
                      active={
                        form.balanceType !==
                        "advance"
                      }
                      onPress={() =>
                        setForm({
                          ...form,
                          balanceType: "due",
                        })
                      }
                    />

                    <Choice
                      title="Advance"
                      active={
                        form.balanceType ===
                        "advance"
                      }
                      onPress={() =>
                        setForm({
                          ...form,
                          balanceType:
                            "advance",
                        })
                      }
                    />
                  </View>

                  <SaveButton
                    title={
                      form.id
                        ? "Update Party"
                        : "Save Party"
                    }
                    onPress={saveParty}
                  />
                </>
              )}

              {(modal === "received" ||
                modal === "given") && (
                <>
                  <Field
                    label="Amount"
                    value={inputValue(
                      form.amount
                    )}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        amount: v,
                      })
                    }
                    placeholder="Amount"
                    keyboardType="numeric"
                  />

                  <Text style={styles.fieldLabel}>
                    Payment Mode
                  </Text>

                  <View
                    style={styles.choiceRow}
                  >
                    {[
                      "Cash",
                      "UPI",
                      "Bank",
                      "Cheque",
                    ].map((x) => (
                      <Choice
                        key={x}
                        title={x}
                        active={
                          form.paymentMode ===
                          x
                        }
                        onPress={() =>
                          setForm({
                            ...form,
                            paymentMode: x,
                          })
                        }
                      />
                    ))}
                  </View>

                  <Field
                    label="Reference"
                    value={form.reference}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        reference: v,
                      })
                    }
                    placeholder="Transaction/reference no."
                  />

                  <Field
                    label="Note"
                    value={form.note}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        note: v,
                      })
                    }
                    placeholder="Optional note"
                  />

                  <Field
                    label="Date"
                    value={form.date}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        date: v,
                      })
                    }
                    placeholder="DD/MM/YYYY"
                  />

                  <SaveButton
                    title="Save Payment"
                    onPress={savePayment}
                  />
                </>
              )}

              {(modal === "sale" ||
                modal === "purchase") && (
                <>
                  <Field
                    label="Amount"
                    value={inputValue(
                      form.amount
                    )}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        amount: v,
                      })
                    }
                    placeholder="Amount"
                    keyboardType="numeric"
                  />

                  <Text style={styles.fieldLabel}>
                    Mode
                  </Text>

                  <View
                    style={styles.choiceRow}
                  >
                    {[
                      "Credit",
                      "Cash",
                      "UPI",
                      "Bank",
                    ].map((x) => (
                      <Choice
                        key={x}
                        title={x}
                        active={
                          form.paymentMode ===
                          x
                        }
                        onPress={() =>
                          setForm({
                            ...form,
                            paymentMode: x,
                          })
                        }
                      />
                    ))}
                  </View>

                  <Field
                    label="Reference"
                    value={form.reference}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        reference: v,
                      })
                    }
                    placeholder="Reference"
                  />

                  <Field
                    label="Note"
                    value={form.note}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        note: v,
                      })
                    }
                    placeholder="Optional note"
                  />

                  <Field
                    label="Date"
                    value={form.date}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        date: v,
                      })
                    }
                    placeholder="DD/MM/YYYY"
                  />

                  <SaveButton
                    title={
                      modal === "sale"
                        ? "Save Sale"
                        : "Save Purchase"
                    }
                    onPress={
                      saveSalePurchase
                    }
                  />
                </>
              )}

              {modal === "expense" && (
                <>
                  <Field
                    label="Expense"
                    value={form.title}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        title: v,
                      })
                    }
                    placeholder="Expense name"
                  />

                  <Field
                    label="Amount"
                    value={inputValue(
                      form.amount
                    )}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        amount: v,
                      })
                    }
                    placeholder="Amount"
                    keyboardType="numeric"
                  />

                  <Field
                    label="Note"
                    value={form.note}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        note: v,
                      })
                    }
                    placeholder="Optional note"
                  />

                  <Field
                    label="Date"
                    value={form.date}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        date: v,
                      })
                    }
                    placeholder="DD/MM/YYYY"
                  />

                  <SaveButton
                    title="Save Expense"
                    onPress={saveExpense}
                  />
                </>
              )}

              {modal === "business" && (
                <>
                  <Field
                    label="Business Name"
                    value={form.name}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        name: v,
                      })
                    }
                    placeholder="Business name"
                  />

                  <Field
                    label="Phone"
                    value={form.phone}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        phone: v,
                      })
                    }
                    placeholder="Business phone"
                    keyboardType="phone-pad"
                  />

                  <Field
                    label="Address"
                    value={form.address}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        address: v,
                      })
                    }
                    placeholder="Business address"
                  />

                  <Field
                    label="GST"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        gst: v,
                      })
                    }
                    placeholder="GST number"
                  />

                  <SaveButton
                    title="Save Business"
                    onPress={saveBusiness}
                  />
                </>
              )}

              {modal === "setPin" && (
                <>
                  <Field
                    label="New PIN"
                    value={form.newPin}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        newPin: v,
                      })
                    }
                    placeholder="4-6 digit PIN"
                    keyboardType="numeric"
                    secureTextEntry
                  />

                  <SaveButton
                    title="Save PIN"
                    onPress={savePin}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  /*
   * -------------------------------------------------------
   * LOADING / LOCK
   * -------------------------------------------------------
   */

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#167a46"
        />

        <Text style={styles.loadingTitle}>
          Vyapar Khata
        </Text>

        <Text style={styles.loadingText}>
          Loading your business data...
        </Text>
      </SafeAreaView>
    );
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.lockScreen}>
        <View style={styles.lockCircle}>
          <Text style={styles.lockIcon}>
            🔐
          </Text>
        </View>

        <Text style={styles.lockTitle}>
          Vyapar Khata
        </Text>

        <Text style={styles.lockText}>
          Enter your PIN to continue
        </Text>

        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          placeholder="PIN"
          placeholderTextColor="#98A2B3"
        />

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={unlock}
        >
          <Text style={styles.unlockText}>
            Unlock
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {page === "home"
        ? renderHome()
        : renderParty()}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => {
            setPage("home");
            setSelected(null);
          }}
        >
          <Text style={styles.bottomIcon}>
            🏠
          </Text>

          <Text style={styles.bottomText}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={setPinForApp}
        >
          <Text style={styles.bottomIcon}>
            🔐
          </Text>

          <Text style={styles.bottomText}>
            PIN
          </Text>
        </TouchableOpacity>

        {savedPin ? (
          <TouchableOpacity
            style={styles.bottomItem}
            onPress={removePin}
          >
            <Text style={styles.bottomIcon}>
              🔓
            </Text>

            <Text style={styles.bottomText}>
              Remove PIN
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {renderModal()}
    </SafeAreaView>
  );
}

/*
 * -------------------------------------------------------
 * COMPONENTS
 * -------------------------------------------------------
 */

function Summary({
  title,
  value,
  type,
  icon,
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <Text style={styles.summaryLabel}>
          {title}
        </Text>

        <View
          style={[
            styles.summaryIcon,
            type === "red" &&
              styles.summaryIconRed,
            type === "orange" &&
              styles.summaryIconOrange,
            type === "green" &&
              styles.summaryIconGreen,
            type === "blue" &&
              styles.summaryIconBlue,
          ]}
        >
          <Text>{icon}</Text>
        </View>
      </View>

      <Text
        style={[
          styles.summaryValue,
          type === "red" && styles.red,
          type === "orange" && styles.orange,
          type === "green" && styles.green,
          type === "blue" && styles.blue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function StatRow({
  title,
  value,
  positive,
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statTitle}>
        {title}
      </Text>

      <Text
        style={
          positive
            ? styles.greenText
            : styles.redText
        }
      >
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={
          value === undefined ||
          value === null
            ? ""
            : String(value)
        }
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        keyboardType={keyboardType}
        secureTextEntry={
          secureTextEntry
        }
        autoCapitalize="none"
      />
    </View>
  );
}

function Choice({
  title,
  active,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.choice,
        active &&
          styles.choiceActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.choiceText,
          active &&
            styles.choiceTextActive,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SaveButton({
  title,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.saveButton}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.saveButtonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/*
 * -------------------------------------------------------
 * STYLES
 * -------------------------------------------------------
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  content: {
    padding: 16,
    paddingBottom: 120,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FB",
  },

  loadingTitle: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 12,
  },

  loadingText: {
    color: "#718096",
    marginTop: 4,
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  greeting: {
    fontSize: 12,
    color: "#167A46",
    fontWeight: "800",
    marginBottom: 3,
  },

  brand: {
    fontSize: 27,
    fontWeight: "900",
    color: "#111827",
  },

  subBrand: {
    color: "#718096",
    marginTop: 3,
    fontSize: 13,
  },

  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },

  settingsText: {
    fontSize: 22,
  },

  overviewCard: {
    backgroundColor: "#167A46",
    borderRadius: 20,
    padding: 19,
    marginBottom: 14,
    elevation: 4,
  },

  overviewTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },

  overviewSub: {
    color: "#D7F2E2",
    fontSize: 12,
    marginTop: 4,
  },

  overviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },

  overviewLabel: {
    color: "#D7F2E2",
    fontSize: 12,
    marginBottom: 4,
  },

  overviewGreen: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  overviewRed: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryLabel: {
    color: "#718096",
    fontSize: 12,
    fontWeight: "800",
  },

  summaryIcon: {
    width: 29,
    height: 29,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryIconRed: {
    backgroundColor: "#FDECEC",
  },

  summaryIconOrange: {
    backgroundColor: "#FFF2E4",
  },

  summaryIconGreen: {
    backgroundColor: "#E8F6EE",
  },

  summaryIconBlue: {
    backgroundColor: "#EAF0FF",
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },

  red: {
    color: "#D32F2F",
  },

  orange: {
    color: "#E67E22",
  },

  green: {
    color: "#168653",
  },

  blue: {
    color: "#2463EB",
  },

  gray: {
    color: "#777777",
  },

  quickTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#167A46",
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E5EA",
  },

  secondaryButtonText: {
    color: "#1F2937",
    fontWeight: "900",
    fontSize: 14,
  },

  actionIcon: {
    fontSize: 19,
    marginBottom: 3,
  },

  expenseButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E5EA",
    padding: 14,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  expenseIcon: {
    fontSize: 22,
    marginRight: 12,
  },

  expenseButtonText: {
    fontWeight: "900",
    color: "#1F2937",
  },

  expenseSub: {
    color: "#8A94A6",
    fontSize: 11,
    marginTop: 3,
  },

  arrow: {
    fontSize: 28,
    color: "#98A2B3",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 11,
  },

  countText: {
    color: "#8A94A6",
    fontSize: 12,
    marginBottom: 11,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#E8EDF3",
    borderRadius: 14,
    padding: 3,
    marginBottom: 11,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },

  activeTab: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },

  tabText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#667085",
  },

  activeTabText: {
    color: "#167A46",
    fontWeight: "900",
  },

  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E7EBF0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  tabBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#667085",
  },

  search: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E1E5EA",
    color: "#111827",
  },

  partyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 12,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#167A46",
  },

  partyInfo: {
    flex: 1,
  },

  partyName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1F2937",
  },

  partyPhone: {
    color: "#718096",
    marginTop: 3,
    fontSize: 12,
  },

  balanceBox: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  balanceStatus: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
  },

  partyBalance: {
    fontSize: 15,
    fontWeight: "900",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  emptyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EAF3ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  emptyIcon: {
    fontSize: 31,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1F2937",
  },

  emptyText: {
    color: "#718096",
    marginTop: 5,
    textAlign: "center",
    lineHeight: 19,
  },

  emptyButton: {
    marginTop: 15,
    backgroundColor: "#167A46",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  smallEmpty: {
    alignItems: "center",
    paddingVertical: 18,
  },

  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 16,
    marginTop: 12,
    marginBottom: 22,
  },

  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },

  statsTitle: {
    fontWeight: "900",
    fontSize: 17,
  },

  statsIcon: {
    fontSize: 21,
  },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },

  statTitle: {
    color: "#4B5563",
  },

  greenText: {
    color: "#168653",
    fontWeight: "900",
  },

  redText: {
    color: "#D32F2F",
    fontWeight: "900",
  },

  blueText: {
    color: "#2463EB",
    fontWeight: "900",
  },

  transactionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F4F7",
    alignItems: "center",
    justifyContent: "center",
  },

  transactionName: {
    fontWeight: "900",
    fontSize: 15,
    color: "#1F2937",
  },

  transactionType: {
    color: "#667085",
    marginTop: 3,
    fontSize: 12,
  },

  transactionDate: {
    color: "#98A2B3",
    fontSize: 11,
    marginTop: 3,
  },

  transactionAmount: {
    fontWeight: "900",
    fontSize: 15,
    marginLeft: 8,
  },

  backButton: {
    marginBottom: 15,
  },

  backText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#167A46",
  },

  profileCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 15,
  },

  bigAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  bigAvatarText: {
    color: "#167A46",
    fontSize: 29,
    fontWeight: "900",
  },

  profileName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },

  profilePhone: {
    color: "#718096",
    marginTop: 5,
  },

  profileDetail: {
    color: "#667085",
    marginTop: 5,
    textAlign: "center",
    fontSize: 12,
  },

  balanceDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#EEF1F4",
    marginTop: 17,
  },

  balanceCaption: {
    color: "#718096",
    marginTop: 14,
  },

  bigBalance: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },

  balanceWord: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  receiveButton: {
    width: "48%",
    backgroundColor: "#168653",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  giveButton: {
    width: "48%",
    backgroundColor: "#D32F2F",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  actionButtonIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginTop: 2,
  },

  normalAction: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E5EA",
    marginBottom: 10,
  },

  normalActionIcon: {
    fontSize: 17,
  },

  normalActionText: {
    fontWeight: "900",
    marginTop: 2,
  },

  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 3,
    marginBottom: 22,
  },

  contactButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E1E5EA",
  },

  contactText: {
    fontWeight: "900",
  },

  deleteButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFB7B7",
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },

  deleteText: {
    color: "#D32F2F",
    fontWeight: "900",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E9EDF1",
    flexDirection: "row",
    paddingVertical: 9,
    paddingBottom:
      Platform.OS === "ios"
        ? 22
        : 9,
  },

  bottomItem: {
    flex: 1,
    alignItems: "center",
  },

  bottomIcon: {
    fontSize: 18,
  },

  bottomText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "700",
    color: "#475467",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },

  modalBox: {
    backgroundColor: "#F6F8FA",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: "94%",
    padding: 18,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
  },

  modalSub: {
    color: "#718096",
    fontSize: 11,
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    fontSize: 19,
    color: "#555",
  },

  contactPickerButton: {
    backgroundColor: "#167A46",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  contactPickerCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  contactPickerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  contactPickerSub: {
    color: "#D9F2E4",
    marginTop: 3,
    fontSize: 11,
  },

  contactPickerArrow: {
    color: "#FFFFFF",
    fontSize: 28,
    marginLeft: 8,
  },

  field: {
    marginBottom: 12,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    color: "#444",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE3E8",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },

  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 15,
  },

  choice: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  choiceActive: {
    backgroundColor: "#222222",
    borderColor: "#222222",
  },

  choiceText: {
    fontWeight: "600",
  },

  choiceTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  saveButton: {
    backgroundColor: "#167A46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 5,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  lockScreen: {
    flex: 1,
    backgroundColor: "#F4F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  lockCircle: {
    width: 85,
    height: 85,
    borderRadius: 43,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  lockIcon: {
    fontSize: 42,
  },

  lockTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#111827",
  },

  lockText: {
    color: "#777",
    marginTop: 6,
    marginBottom: 20,
  },

  pinInput: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 15,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
  },

  unlockButton: {
    width: "80%",
    backgroundColor: "#167A46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 15,
  },

  unlockText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});
