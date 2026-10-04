
import React, { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DATA_KEY = "@vyapar_khata_data_v3";
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

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const d = await AsyncStorage.getItem(DATA_KEY);
      const p = await AsyncStorage.getItem(PIN_KEY);

      if (d) {
        const x = JSON.parse(d);

        setData({
          ...EMPTY_DATA,
          ...x,
          business: {
            ...EMPTY_DATA.business,
            ...(x.business || {}),
          },
          customers: Array.isArray(x.customers)
            ? x.customers
            : [],
          suppliers: Array.isArray(x.suppliers)
            ? x.suppliers
            : [],
          transactions: Array.isArray(x.transactions)
            ? x.transactions
            : [],
          expenses: Array.isArray(x.expenses)
            ? x.expenses
            : [],
        });
      }

      if (p) {
        setSavedPin(p);
        setLocked(true);
      }
    } catch (e) {
      console.log("Load error:", e);
    }

    setReady(true);
  }

  useEffect(() => {
    if (ready) {
      AsyncStorage.setItem(
        DATA_KEY,
        JSON.stringify(data)
      ).catch((e) => console.log("Save error:", e));
    }
  }, [data, ready]);

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

  function saveParty() {
    if (!String(form.name || "").trim()) {
      Alert.alert("Required", "Name enter karein.");
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
      openingBalance: num(form.openingBalance),
      balanceType: form.balanceType || "due",
    };

    setData((old) => {
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

            setData((old) => ({
              ...old,
              [key]: old[key].filter(
                (x) => x.id !== party.id
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
      paymentMode: form.paymentMode || "Cash",
      reference: inputValue(form.reference),
      note: inputValue(form.note),
      date: form.date || today(),
      createdAt: Date.now(),
    };

    setData((old) => ({
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
      paymentMode: form.paymentMode || "Credit",
      reference: inputValue(form.reference),
      note: inputValue(form.note),
      date: form.date || today(),
      createdAt: Date.now(),
    };

    setData((old) => ({
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
      paymentMode: form.paymentMode || "Cash",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    setData((old) => ({
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

  function openBusiness() {
    setForm({
      ...data.business,
    });

    setModal("business");
  }

  function saveBusiness() {
    setData((old) => ({
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
      Alert.alert(
        "Phone",
        "Phone number available nahi hai."
      );
      return;
    }

    const phone = String(selected.phone).replace(
      /[^0-9+]/g,
      ""
    );

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (e) {
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

    const balanceAmount = balance(selected);

    const message =
      `Namaste ${selected.name},\n\n` +
      `${data.business.name}\n` +
      `Your current balance: ${money(
        Math.abs(balanceAmount)
      )}\n\n` +
      `Thank you.`;

    const phone = String(selected.phone).replace(
      /[^0-9]/g,
      ""
    );

    const url =
      `https://wa.me/${phone}?text=` +
      encodeURIComponent(message);

    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        "WhatsApp",
        "WhatsApp open nahi ho saka."
      );
    }
  }

  function setPinForApp() {
    setForm({
      newPin: "",
    });

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
    } catch (e) {
      Alert.alert(
        "Error",
        "PIN save nahi ho saka."
      );
    }
  }

  async function unlock() {
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

  async function removePin() {
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
            await AsyncStorage.removeItem(PIN_KEY);
            setSavedPin("");
            setLocked(false);
          },
        },
      ]
    );
  }

  function transactionTitle(t) {
    return titleFor(t.type);
  }

  function renderHome() {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              {data.business.name}
            </Text>
            <Text style={styles.subBrand}>
              Vyapar Management
            </Text>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openBusiness}
          >
            <Text style={styles.settingsText}>
              ⚙
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Receivable
            </Text>
            <Text style={styles.receivable}>
              {money(receivable)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Payable
            </Text>
            <Text style={styles.payable}>
              {money(payable)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Sales
            </Text>
            <Text style={styles.summaryValue}>
              {money(sales)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Purchases
            </Text>
            <Text style={styles.summaryValue}>
              {money(purchases)}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => openParty("customer")}
          >
            <Text style={styles.primaryButtonText}>
              + Customer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => openParty("supplier")}
          >
            <Text style={styles.secondaryButtonText}>
              + Supplier
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.expenseButton}
          onPress={openExpense}
        >
          <Text style={styles.expenseButtonText}>
            + Add Expense
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Parties
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === "customers" &&
                styles.activeTab,
            ]}
            onPress={() => setTab("customers")}
          >
            <Text
              style={[
                styles.tabText,
                tab === "customers" &&
                  styles.activeTabText,
              ]}
            >
              Customers ({data.customers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              tab === "suppliers" &&
                styles.activeTab,
            ]}
            onPress={() => setTab("suppliers")}
          >
            <Text
              style={[
                styles.tabText,
                tab === "suppliers" &&
                  styles.activeTabText,
              ]}
            >
              Suppliers ({data.suppliers.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search name or phone"
          value={search}
          onChangeText={setSearch}
        />

        {(tab === "customers"
          ? customers
          : suppliers
        ).map((party) => {
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

        {(tab === "customers"
          ? customers
          : suppliers
        ).length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              No {tab} yet
            </Text>

            <Text style={styles.emptyText}>
              Add your first {tab.slice(0, -1)}.
            </Text>
          </View>
        )}

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>
            Cash Summary
          </Text>

          <View style={styles.statRow}>
            <Text>Received</Text>
            <Text style={styles.greenText}>
              {money(received)}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text>Given</Text>
            <Text style={styles.redText}>
              {money(given)}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text>Expenses</Text>
            <Text style={styles.redText}>
              {money(expenses)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Recent Transactions
          </Text>
        </View>

        {data.transactions
          .slice(0, 10)
          .map((t) => (
            <View
              key={t.id}
              style={styles.transactionCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.transactionName}>
                  {t.partyName}
                </Text>

                <Text style={styles.transactionType}>
                  {transactionTitle(t)}
                </Text>

                <Text style={styles.transactionDate}>
                  {t.date}
                </Text>
              </View>

              <Text
                style={[
                  styles.transactionAmount,
                  t.type === "received" ||
                  t.type === "purchase"
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
    if (!selected) {
      setPage("home");
      return null;
    }

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
            ← Back
          </Text>
        </TouchableOpacity>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>
            {selected.name}
          </Text>

          <Text style={styles.profilePhone}>
            {selected.phone || "No phone"}
          </Text>

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
            onPress={() => openParty(
              selected.type,
              selected
            )}
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
              WhatsApp
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
            <Text style={styles.emptyTitle}>
              No transactions
            </Text>

            <Text style={styles.emptyText}>
              Payment or sale/purchase add karein.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderModal() {
    const visible = Boolean(modal);

    if (!visible) return null;

    return (
      <Modal
        visible={visible}
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
                paddingBottom: 20,
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
                  <Text style={styles.closeText}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {(modal === "customer" ||
                modal === "supplier" ||
                modal === "editParty") && (
                <>
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

                  <View style={styles.choiceRow}>
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
                          form.paymentMode === x
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
                          form.paymentMode === x
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
        <Text style={styles.loadingTitle}>
          Vyapar Khata
        </Text>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.lockScreen}>
        <Text style={styles.lockIcon}>
          🔐
        </Text>

        <Text style={styles.lockTitle}>
          Vyapar Khata Locked
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

function Choice({
  title,
  active,
  onPress,
}) {
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

function SaveButton({
  title,
  onPress,
}) {
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
    backgroundColor: "#f5f7fb",
  },

  content: {
    padding: 16,
    paddingBottom: 110,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fb",
  },

  loadingTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  brand: {
    fontSize: 26,
    fontWeight: "800",
  },

  subBrand: {
    color: "#777",
    marginTop: 2,
  },

  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  settingsText: {
    fontSize: 23,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 1,
  },

  summaryLabel: {
    color: "#777",
    fontSize: 13,
    marginBottom: 6,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  receivable: {
    fontSize: 18,
    fontWeight: "800",
  },

  payable: {
    fontSize: 18,
    fontWeight: "800",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#1d7a46",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  secondaryButtonText: {
    fontWeight: "800",
  },

  expenseButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  expenseButtonText: {
    fontWeight: "800",
  },

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#e9edf3",
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 10,
  },

  activeTab: {
    backgroundColor: "#fff",
  },

  tabText: {
    fontWeight: "600",
    fontSize: 12,
  },

  activeTabText: {
    fontWeight: "800",
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e5e9",
  },

  partyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 15,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 1,
  },

  partyInfo: {
    flex: 1,
  },

  partyName: {
    fontSize: 16,
    fontWeight: "800",
  },

  partyPhone: {
    color: "#777",
    marginTop: 3,
  },

  partyBalance: {
    fontSize: 16,
    fontWeight: "800",
  },

  red: {
    color: "#c62828",
  },

  green: {
    color: "#198754",
  },

  gray: {
    color: "#777",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 30,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },

  emptyText: {
    color: "#777",
    marginTop: 5,
    textAlign: "center",
  },

  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 15,
    marginTop: 12,
    marginBottom: 20,
  },

  statsTitle: {
    fontWeight: "800",
    fontSize: 17,
    marginBottom: 12,
  },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },

  greenText: {
    color: "#198754",
    fontWeight: "800",
  },

  redText: {
    color: "#c62828",
    fontWeight: "800",
  },

  transactionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  transactionName: {
    fontWeight: "800",
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
    fontWeight: "800",
    fontSize: 16,
    marginLeft: 10,
  },

  backButton: {
    marginBottom: 15,
  },

  backText: {
    fontSize: 16,
    fontWeight: "800",
  },

  profileCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 15,
  },

  profileName: {
    fontSize: 24,
    fontWeight: "800",
  },

  profilePhone: {
    color: "#777",
    marginTop: 5,
  },

  profileDetail: {
    color: "#666",
    marginTop: 5,
    textAlign: "center",
  },

  balanceCaption: {
    color: "#777",
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
    backgroundColor: "#198754",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  giveButton: {
    width: "48%",
    backgroundColor: "#c62828",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  actionButtonText: {
    color: "#fff",
    fontWeight: "800",
  },

  normalAction: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
  },

  normalActionText: {
    fontWeight: "800",
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
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  contactText: {
    fontWeight: "800",
  },

  deleteButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0b0b0",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  deleteText: {
    color: "#c62828",
    fontWeight: "800",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
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
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalBox: {
    backgroundColor: "#f7f8fa",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "92%",
    padding: 18,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "900",
  },

  closeText: {
    fontSize: 22,
    color: "#555",
  },

  field: {
    marginBottom: 12,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    color: "#444",
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 11,
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
    backgroundColor: "#1d7a46",
    paddingVertical: 14,
    borderRadius: 12,
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
    backgroundColor: "#f5f7fb",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  lockIcon: {
    fontSize: 50,
    marginBottom: 15,
  },

  lockTitle: {
    fontSize: 24,
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
    backgroundColor: "#1d7a46",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 15,
  },

  unlockText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});
