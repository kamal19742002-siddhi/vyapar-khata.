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
    expenses: Array.isArray(x?.expenses) ? x.expenses : [],
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

      try {
        if (primary) loaded = normalizeData(JSON.parse(primary));
      } catch {}

      let backupData = null;

      try {
        if (backup) {
          backupData = normalizeData(JSON.parse(backup));
        }
      } catch {}

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
      await AsyncStorage.setItem(DATA_KEY, json);
      await AsyncStorage.setItem(BACKUP_KEY, json);
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

    if (party.balanceType === "advance") b = -b;

    data.transactions.forEach((t) => {
      if (
        t.partyId !== party.id ||
        t.partyType !== party.type
      )
        return;

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
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.customers, search]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return data.suppliers;

    return data.suppliers.filter(
      (x) =>
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.suppliers, search]);

  const receivable = data.customers.reduce(
    (s, p) =>
      s +
      Math.max(
        balance({ ...p, type: "customer" }),
        0
      ),
    0
  );

  const payable = data.suppliers.reduce(
    (s, p) =>
      s +
      Math.max(
        balance({ ...p, type: "supplier" }),
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

  function openParty(type, party = null) {
    setForm(
      party
        ? { ...party, type }
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
  }

  // NEW: Android Contacts Picker
  async function pickContact() {
    try {
      setContactLoading(true);

      const permission =
        await Contacts.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Contacts Permission",
          "Customer/Supplier ka data automatically lene ke liye Contacts permission allow karein."
        );
        return;
      }

      const result =
        await Contacts.presentContactPickerAsync();

      if (!result || !result.contact) return;

      const contact = result.contact;

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

      setForm((old) => ({
        ...old,
        name:
          contact.name ||
          contact.firstName ||
          old.name ||
          "",
        phone,
        email,
        address,
      }));
    } catch (e) {
      console.log("Contact picker error:", e);
      Alert.alert(
        "Contacts",
        "Contact select nahi ho saka."
      );
    } finally {
      setContactLoading(false);
    }
  }

  function saveParty() {
    if (!String(form.name || "").trim()) {
      Alert.alert("Required", "Name enter karein.");
      return;
    }

    const type =
      form.type ||
      (modal === "supplier" ? "supplier" : "customer");

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
      `${type === "customer" ? "Customer" : "Supplier"} saved successfully.`
    );
  }

  function deleteParty(party) {
    Alert.alert(
      "Delete",
      `Delete ${party.name}?`,
      [
        { text: "Cancel", style: "cancel" },
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
              transactions: old.transactions.filter(
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
    setSelected({ ...party, type });
    setPage("party");
  }

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
      Alert.alert("Amount", "Valid amount enter karein.");
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
      paymentMode: form.paymentMode || "Cash",
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
      Alert.alert("Amount", "Valid amount enter karein.");
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
      paymentMode: form.paymentMode || "Credit",
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
      Alert.alert("Required", "Expense name enter karein.");
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert("Amount", "Valid amount enter karein.");
      return;
    }

    const expense = {
      id: uid("expense"),
      title: String(form.title).trim(),
      amount,
      note: inputValue(form.note),
      paymentMode: form.paymentMode || "Cash",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    updateData((old) => ({
      ...old,
      expenses: [expense, ...old.expenses],
    }));

    setModal("");

    Alert.alert(
      "Expense Saved",
      "Expense successfully saved."
    );
  }

  function openBusiness() {
    setForm({ ...data.business });
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

  async function callParty() {
    if (!selected?.phone) {
      Alert.alert("Phone", "Phone number available nahi hai.");
      return;
    }

    const phone = String(selected.phone).replace(
      /[^0-9+]/g,
      ""
    );

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert("Error", "Phone app open nahi ho saka.");
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

    const balanceAmount = balance(selected);

    const message =
      `Namaste ${selected.name},\n\n` +
      `${data.business.name}\n` +
      `Your current balance: ${money(
        Math.abs(balanceAmount)
      )}\n\nThank you.`;

    let phone = String(selected.phone).replace(
      /[^0-9]/g,
      ""
    );

    // Indian numbers
    if (phone.length === 10) phone = "91" + phone;

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

  function setPinForApp() {
    setForm({ newPin: "" });
    setModal("setPin");
  }

  async function savePin() {
    const newPin = String(form.newPin || "").trim();

    if (!/^\d{4,6}$/.test(newPin)) {
      Alert.alert(
        "PIN",
        "4 se 6 digit ka PIN enter karein."
      );
      return;
    }

    try {
      await AsyncStorage.setItem(PIN_KEY, newPin);
      setSavedPin(newPin);
      setLocked(false);
      setPin("");
      setModal("");

      Alert.alert("PIN Saved", "App PIN successfully set.");
    } catch {
      Alert.alert("Error", "PIN save nahi ho saka.");
    }
  }

  function unlock() {
    if (pin === savedPin) {
      setLocked(false);
      setPin("");
    } else {
      Alert.alert("Wrong PIN", "PIN incorrect hai.");
    }
  }

  function removePin() {
    Alert.alert(
      "Remove PIN",
      "App PIN remove karna hai?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(PIN_KEY);
            setSavedPin("");
            setLocked(false);
          },
        },
      ]
    );
  }

  function renderHome() {
    const list =
      tab === "customers" ? customers : suppliers;

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
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
            <Text style={styles.settingsText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <Summary
            title="Receivable"
            value={money(receivable)}
            type="red"
          />
          <Summary
            title="Payable"
            value={money(payable)}
            type="orange"
          />
          <Summary
            title="Sales"
            value={money(sales)}
            type="green"
          />
          <Summary
            title="Purchases"
            value={money(purchases)}
            type="blue"
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openParty("customer")}
          >
            <Text style={styles.primaryButtonText}>
              ＋ Customer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openParty("supplier")}
          >
            <Text style={styles.secondaryButtonText}>
              ＋ Supplier
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.expenseButton}
          onPress={openExpense}
        >
          <Text style={styles.expenseButtonText}>
            ＋ Add Expense
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Parties
        </Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === "customers" && styles.activeTab,
            ]}
            onPress={() => setTab("customers")}
          >
            <Text style={styles.tabText}>
              Customers ({data.customers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              tab === "suppliers" && styles.activeTab,
            ]}
            onPress={() => setTab("suppliers")}
          >
            <Text style={styles.tabText}>
              Suppliers ({data.suppliers.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          placeholder="🔎  Search party or phone"
          value={search}
          onChangeText={setSearch}
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
                openPartyDetails(party, type)
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(party.name || "?")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={styles.partyInfo}>
                <Text style={styles.partyName}>
                  {party.name}
                </Text>
                <Text style={styles.partyPhone}>
                  {party.phone || "No phone"}
                </Text>
              </View>

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
            </TouchableOpacity>
          );
        })}

        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>
              No {tab} yet
            </Text>
            <Text style={styles.emptyText}>
              Add a party from your phone contacts.
            </Text>
          </View>
        )}

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>
            Cash Summary
          </Text>

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

        <Text style={styles.sectionTitle}>
          Recent Transactions
        </Text>

        {data.transactions.slice(0, 10).map((t) => (
          <View
            key={t.id}
            style={styles.transactionCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.transactionName}>
                {t.partyName}
              </Text>

              <Text style={styles.transactionType}>
                {titleFor(t.type)}
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
                  : styles.redText,
              ]}
            >
              {money(t.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }

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
          <Text style={styles.backText}>← Back</Text>
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
            {selected.phone || "No phone"}
          </Text>

          {selected.email ? (
            <Text style={styles.profileDetail}>
              {selected.email}
            </Text>
          ) : null}

          {selected.address ? (
            <Text style={styles.profileDetail}>
              {selected.address}
            </Text>
          ) : null}

          {selected.gst ? (
            <Text style={styles.profileDetail}>
              GST: {selected.gst}
            </Text>
          ) : null}

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
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.receiveButton}
            onPress={() =>
              openPayment("received", selected)
            }
          >
            <Text style={styles.actionButtonText}>
              + Received
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.giveButton}
            onPress={() =>
              openPayment("given", selected)
            }
          >
            <Text style={styles.actionButtonText}>
              - Given
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.normalAction}
            onPress={() =>
              openSalePurchase(
                selected.type === "customer"
                  ? "sale"
                  : "purchase"
              )
            }
          >
            <Text style={styles.normalActionText}>
              {selected.type === "customer"
                ? "+ Sale"
                : "+ Purchase"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.normalAction}
            onPress={() =>
              openParty(selected.type, selected)
            }
          >
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

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteParty(selected)}
        >
          <Text style={styles.deleteText}>
            Delete Party
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Ledger
        </Text>

        {transactions.map((t) => (
          <View
            key={t.id}
            style={styles.transactionCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.transactionName}>
                {titleFor(t.type)}
              </Text>

              <Text style={styles.transactionType}>
                {t.note || t.paymentMode}
              </Text>

              <Text style={styles.transactionDate}>
                {t.date}
                {t.reference
                  ? ` • Ref: ${t.reference}`
                  : ""}
              </Text>
            </View>

            <Text style={styles.transactionAmount}>
              {money(t.amount)}
            </Text>
          </View>
        ))}

        {transactions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📒</Text>
            <Text style={styles.emptyTitle}>
              No transactions
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

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
        onRequestClose={() => setModal("")}
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

                <TouchableOpacity
                  onPress={() => setModal("")}
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {partyModal && (
                <>
                  {!form.id && (
                    <TouchableOpacity
                      style={styles.contactPickerButton}
                      onPress={pickContact}
                      disabled={contactLoading}
                    >
                      {contactLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.contactPickerIcon}>
                            👤
                          </Text>
                          <View>
                            <Text style={styles.contactPickerTitle}>
                              Choose from Contacts
                            </Text>
                            <Text style={styles.contactPickerSub}>
                              Name & phone automatically fill honge
                            </Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <Field
                    label="Name"
                    value={form.name}
                    onChangeText={(v) =>
                      setForm({ ...form, name: v })
                    }
                    placeholder="Party name"
                  />

                  <Field
                    label="Phone"
                    value={form.phone}
                    onChangeText={(v) =>
                      setForm({ ...form, phone: v })
                    }
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />

                  <Field
                    label="Email"
                    value={form.email}
                    onChangeText={(v) =>
                      setForm({ ...form, email: v })
                    }
                    placeholder="Email"
                    keyboardType="email-address"
                  />

                  <Field
                    label="Address"
                    value={form.address}
                    onChangeText={(v) =>
                      setForm({ ...form, address: v })
                    }
                    placeholder="Address"
                  />

                  <Field
                    label="GST"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({ ...form, gst: v })
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

                  <View style={styles.choiceRow}>
                    <Choice
                      title="Due"
                      active={
                        form.balanceType !== "advance"
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
                        form.balanceType === "advance"
                      }
                      onPress={() =>
                        setForm({
                          ...form,
                          balanceType: "advance",
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
                    value={inputValue(form.amount)}
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

                  <View style={styles.choiceRow}>
                    {["Cash", "UPI", "Bank", "Cheque"].map(
                      (x) => (
                        <Choice
                          key={x}
                          title={x}
                          active={
                            form.paymentMode === x
                          }
                          onPress={() =>
                            setForm({
                              ...form,
                              paymentMode: x,
                            })
                          }
                        />
                      )
                    )}
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
                    value={inputValue(form.amount)}
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

                  <View style={styles.choiceRow}>
                    {["Credit", "Cash", "UPI", "Bank"].map(
                      (x) => (
                        <Choice
                          key={x}
                          title={x}
                          active={
                            form.paymentMode === x
                          }
                          onPress={() =>
                            setForm({
                              ...form,
                              paymentMode: x,
                            })
                          }
                        />
                      )
                    )}
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
                    onPress={saveSalePurchase}
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
                    value={inputValue(form.amount)}
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

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingTitle}>
          Vyapar Khata
        </Text>
        <Text>Loading your business data...</Text>
      </SafeAreaView>
    );
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔐</Text>

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
          <Text style={styles.bottomIcon}>🏠</Text>
          <Text style={styles.bottomText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={setPinForApp}
        >
          <Text style={styles.bottomIcon}>🔐</Text>
          <Text style={styles.bottomText}>PIN</Text>
        </TouchableOpacity>

        {savedPin ? (
          <TouchableOpacity
            style={styles.bottomItem}
            onPress={removePin}
          >
            <Text style={styles.bottomIcon}>🔓</Text>
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

function Summary({ title, value, type }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{title}</Text>
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

function StatRow({ title, value, positive }) {
  return (
    <View style={styles.statRow}>
      <Text>{title}</Text>
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
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        style={styles.input}
        value={
          value === undefined || value === null
            ? ""
            : String(value)
        }
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
    </View>
  );
}

function Choice({ title, active, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.choice,
        active && styles.choiceActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.choiceText,
          active && styles.choiceTextActive,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SaveButton({ title, onPress }) {
  return (
    <TouchableOpacity
      style={styles.saveButton}
      onPress={onPress}
    >
      <Text style={styles.saveButtonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  content: {
    padding: 16,
    paddingBottom: 115,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f7fb",
  },

  loadingTitle: {
    fontSize: 25,
    fontWeight: "900",
    marginVertical: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  brand: {
    fontSize: 27,
    fontWeight: "900",
  },

  subBrand: {
    color: "#718096",
    marginTop: 3,
  },

  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },

  settingsText: {
    fontSize: 22,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },

  summaryLabel: {
    color: "#718096",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  red: {
    color: "#d32f2f",
  },

  orange: {
    color: "#e67e22",
  },

  green: {
    color: "#168653",
  },

  blue: {
    color: "#2463eb",
  },

  gray: {
    color: "#777",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#167a46",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },

  secondaryButtonText: {
    fontWeight: "900",
    fontSize: 15,
  },

  expenseButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 22,
  },

  expenseButtonText: {
    fontWeight: "800",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 11,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#e8edf3",
    borderRadius: 13,
    padding: 3,
    marginBottom: 11,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 10,
  },

  activeTab: {
    backgroundColor: "#fff",
    elevation: 1,
  },

  tabText: {
    fontWeight: "800",
    fontSize: 12,
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },

  partyCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e8f4ed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#167a46",
  },

  partyInfo: {
    flex: 1,
  },

  partyName: {
    fontSize: 16,
    fontWeight: "900",
  },

  partyPhone: {
    color: "#718096",
    marginTop: 3,
  },

  partyBalance: {
    fontSize: 16,
    fontWeight: "900",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 35,
  },

  emptyIcon: {
    fontSize: 35,
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
  },

  emptyText: {
    color: "#718096",
    marginTop: 5,
    textAlign: "center",
  },

  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 22,
  },

  statsTitle: {
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },

  greenText: {
    color: "#168653",
    fontWeight: "900",
  },

  redText: {
    color: "#d32f2f",
    fontWeight: "900",
  },

  transactionCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  transactionName: {
    fontWeight: "900",
    fontSize: 15,
  },

  transactionType: {
    color: "#666",
    marginTop: 3,
  },

  transactionDate: {
    color: "#999",
    fontSize: 12,
    marginTop: 3,
  },

  transactionAmount: {
    fontWeight: "900",
    fontSize: 16,
    marginLeft: 10,
  },

  backButton: {
    marginBottom: 15,
  },

  backText: {
    fontSize: 16,
    fontWeight: "900",
  },

  profileCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 15,
  },

  bigAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#e8f4ed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  bigAvatarText: {
    color: "#167a46",
    fontSize: 28,
    fontWeight: "900",
  },

  profileName: {
    fontSize: 24,
    fontWeight: "900",
  },

  profilePhone: {
    color: "#718096",
    marginTop: 5,
  },

  profileDetail: {
    color: "#666",
    marginTop: 5,
    textAlign: "center",
  },

  balanceCaption: {
    color: "#718096",
    marginTop: 18,
  },

  bigBalance: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  receiveButton: {
    width: "48%",
    backgroundColor: "#168653",
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: "center",
    marginBottom: 10,
  },

  giveButton: {
    width: "48%",
    backgroundColor: "#d32f2f",
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: "center",
    marginBottom: 10,
  },

  actionButtonText: {
    color: "#fff",
    fontWeight: "900",
  },

  normalAction: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 10,
  },

  normalActionText: {
    fontWeight: "900",
  },

  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 5,
    marginBottom: 12,
  },

  contactButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },

  contactText: {
    fontWeight: "900",
  },

  deleteButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#efb7b7",
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginBottom: 20,
  },

  deleteText: {
    color: "#d32f2f",
    fontWeight: "900",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9edf1",
    flexDirection: "row",
    paddingVertical: 9,
    paddingBottom: Platform.OS === "ios" ? 22 : 9,
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
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "flex-end",
  },

  modalBox: {
    backgroundColor: "#f6f8fa",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  },

  closeText: {
    fontSize: 22,
    color: "#555",
  },

  contactPickerButton: {
    backgroundColor: "#167a46",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  contactPickerIcon: {
    fontSize: 27,
    marginRight: 12,
  },

  contactPickerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },

  contactPickerSub: {
    color: "#d9f2e4",
    marginTop: 3,
    fontSize: 11,
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe3e8",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
  },

  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 15,
  },

  choice: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  choiceActive: {
    backgroundColor: "#222",
    borderColor: "#222",
  },

  choiceText: {
    fontWeight: "600",
  },

  choiceTextActive: {
    color: "#fff",
    fontWeight: "800",
  },

  saveButton: {
    backgroundColor: "#167a46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 5,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  lockScreen: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  lockIcon: {
    fontSize: 50,
    marginBottom: 15,
  },

  lockTitle: {
    fontSize: 25,
    fontWeight: "900",
  },

  lockText: {
    color: "#777",
    marginTop: 6,
    marginBottom: 20,
  },

  pinInput: {
    width: "80%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 15,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
  },

  unlockButton: {
    width: "80%",
    backgroundColor: "#167a46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 15,
  },

  unlockText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});
