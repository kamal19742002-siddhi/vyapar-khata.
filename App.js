
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
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";

const DATA_KEY = "@vyapar_khata_data_v4";
const BACKUP_KEY = "@vyapar_khata_backup_v4";
const PIN_KEY = "@vyapar_khata_pin_v4";

const EMPTY = {
  business: {
    name: "Vyapar Khata",
    phone: "",
    address: "",
    gst: "",
    state: "",
  },
  customers: [],
  suppliers: [],
  products: [],
  transactions: [],
  expenses: [],
  invoices: [],
  estimates: [],
};

const money = (n) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN");

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
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

function normalize(x) {
  x = x || {};
  return {
    ...EMPTY,
    ...x,
    business: { ...EMPTY.business, ...(x.business || {}) },
    customers: Array.isArray(x.customers) ? x.customers : [],
    suppliers: Array.isArray(x.suppliers) ? x.suppliers : [],
    products: Array.isArray(x.products) ? x.products : [],
    transactions: Array.isArray(x.transactions) ? x.transactions : [],
    expenses: Array.isArray(x.expenses) ? x.expenses : [],
    invoices: Array.isArray(x.invoices) ? x.invoices : [],
    estimates: Array.isArray(x.estimates) ? x.estimates : [],
  };
}

function transactionTitle(type) {
  const map = {
    received: "Payment Received",
    given: "Payment Given",
    sale: "Credit / Sale",
    purchase: "Purchase",
  };
  return map[type] || "Transaction";
}

export default function App() {
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  const [page, setPage] = useState("home");
  const [tab, setTab] = useState("customers");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState("");
  const [form, setForm] = useState({});
  const [selected, setSelected] = useState(null);

  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [main, backup, p] = await Promise.all([
        AsyncStorage.getItem(DATA_KEY),
        AsyncStorage.getItem(BACKUP_KEY),
        AsyncStorage.getItem(PIN_KEY),
      ]);

      let result = null;

      try {
        if (main) result = normalize(JSON.parse(main));
      } catch {}

      let backupResult = null;

      try {
        if (backup) backupResult = normalize(JSON.parse(backup));
      } catch {}

      if (
        backupResult &&
        !(
          result?.customers?.length ||
          result?.suppliers?.length ||
          result?.transactions?.length ||
          result?.products?.length ||
          result?.invoices?.length
        )
      ) {
        result = backupResult;
      }

      setData(result || EMPTY);

      if (p) {
        setSavedPin(p);
        setLocked(true);
      }
    } catch (e) {
      console.log(e);
    }

    setReady(true);
  }

  async function save(next) {
    const json = JSON.stringify(next);

    try {
      await AsyncStorage.setItem(DATA_KEY, json);
      await AsyncStorage.setItem(BACKUP_KEY, json);
    } catch (e) {
      Alert.alert("Storage", "Data save nahi ho saka.");
    }
  }

  function update(fn) {
    setData((old) => {
      const next =
        typeof fn === "function" ? fn(old) : fn;

      save(next);
      return next;
    });
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

    return data.customers.filter(
      (x) =>
        !q ||
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.customers, search]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();

    return data.suppliers.filter(
      (x) =>
        !q ||
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.suppliers, search]);

  const receivable = data.customers.reduce(
    (s, p) =>
      s +
      Math.max(balance({ ...p, type: "customer" }), 0),
    0
  );

  const payable = data.suppliers.reduce(
    (s, p) =>
      s +
      Math.max(balance({ ...p, type: "supplier" }), 0),
    0
  );

  const sales = data.transactions
    .filter((x) => x.type === "sale")
    .reduce((s, x) => s + num(x.amount), 0);

  const purchases = data.transactions
    .filter((x) => x.type === "purchase")
    .reduce((s, x) => s + num(x.amount), 0);

  const received = data.transactions
    .filter((x) => x.type === "received")
    .reduce((s, x) => s + num(x.amount), 0);

  const given = data.transactions
    .filter((x) => x.type === "given")
    .reduce((s, x) => s + num(x.amount), 0);

  const expenses = data.expenses.reduce(
    (s, x) => s + num(x.amount),
    0
  );

  const estimatedProfit = sales - purchases - expenses;

  /* ---------------- PARTY ---------------- */

  function openParty(type, party = null) {
    setForm(
      party
        ? { ...party, type }
        : {
            type,
            name: "",
            phone: "",
            email: "",
            address: "",
            gst: "",
            openingBalance: "",
            balanceType: "due",
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

  async function chooseContact() {
    try {
      const permission =
        await Contacts.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission",
          "Contacts permission allow karein."
        );
        return;
      }

      const result =
        await Contacts.presentContactPickerAsync();

      const contact = result?.contact || result;

      if (!contact) return;

      const phone =
        contact.phoneNumbers?.[0]?.number || "";

      const email =
        contact.emails?.[0]?.email || "";

      const address = contact.addresses?.[0]
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
      Alert.alert("Contacts", "Contact select nahi ho saka.");
    }
  }

  function saveParty() {
    if (!String(form.name || "").trim()) {
      Alert.alert("Required", "Name enter karein.");
      return;
    }

    const type = form.type;

    const party = {
      id: form.id || uid(type),
      type,
      name: String(form.name).trim(),
      phone: String(form.phone || ""),
      email: String(form.email || ""),
      address: String(form.address || ""),
      gst: String(form.gst || ""),
      openingBalance: num(form.openingBalance),
      balanceType: form.balanceType || "due",
    };

    update((old) => {
      const key =
        type === "customer" ? "customers" : "suppliers";

      return {
        ...old,
        [key]: form.id
          ? old[key].map((x) =>
              x.id === form.id ? party : x
            )
          : [...old[key], party],
      };
    });

    setModal("");
    Alert.alert("Saved", "Party successfully saved.");
  }

  /* ---------------- PAYMENT ---------------- */

  function openPayment(type, party) {
    setSelected(party);

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

    if (!amount || !selected) {
      Alert.alert("Amount", "Valid amount enter karein.");
      return;
    }

    const tx = {
      id: uid("tx"),
      partyId: selected.id,
      partyType: selected.type,
      partyName: selected.name,
      type: modal,
      amount,
      paymentMode: form.paymentMode || "Cash",
      reference: form.reference || "",
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    update((old) => ({
      ...old,
      transactions: [tx, ...old.transactions],
    }));

    setModal("");
    Alert.alert("Saved", "Payment successfully saved.");
  }

  /* ---------------- SALE / PURCHASE ---------------- */

  function openSale(type) {
    setForm({
      amount: "",
      paymentMode: "Credit",
      reference: "",
      note: "",
      date: today(),
    });

    setModal(type);
  }

  function saveSale() {
    const amount = num(form.amount);

    if (!amount || !selected) {
      Alert.alert("Amount", "Valid amount enter karein.");
      return;
    }

    const tx = {
      id: uid("tx"),
      partyId: selected.id,
      partyType: selected.type,
      partyName: selected.name,
      type: modal,
      amount,
      paymentMode: form.paymentMode || "Credit",
      reference: form.reference || "",
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    update((old) => ({
      ...old,
      transactions: [tx, ...old.transactions],
    }));

    setModal("");
    Alert.alert("Saved", "Transaction saved.");
  }

  /* ---------------- PRODUCT ---------------- */

  function openProduct(product = null) {
    setForm(
      product || {
        name: "",
        sku: "",
        category: "",
        purchasePrice: "",
        sellingPrice: "",
        stock: "",
        lowStock: "5",
        gst: "18",
      }
    );

    setModal(product ? "editProduct" : "product");
  }

  function saveProduct() {
    if (!String(form.name || "").trim()) {
      Alert.alert("Required", "Product name enter karein.");
      return;
    }

    const product = {
      id: form.id || uid("product"),
      name: String(form.name).trim(),
      sku: String(form.sku || ""),
      category: String(form.category || ""),
      purchasePrice: num(form.purchasePrice),
      sellingPrice: num(form.sellingPrice),
      stock: num(form.stock),
      lowStock: num(form.lowStock) || 5,
      gst: num(form.gst),
    };

    update((old) => ({
      ...old,
      products: form.id
        ? old.products.map((x) =>
            x.id === form.id ? product : x
          )
        : [...old.products, product],
    }));

    setModal("");
    Alert.alert("Saved", "Product saved.");
  }

  /* ---------------- INVOICE ---------------- */

  function calculateInvoice() {
    const qty = num(form.quantity) || 1;
    const rate = num(form.rate);
    const discount = num(form.discount);
    const gst = num(form.gst);

    const subtotal = qty * rate;
    const taxable = Math.max(subtotal - discount, 0);

    const gstAmount = (taxable * gst) / 100;
    const half = gstAmount / 2;

    return {
      qty,
      rate,
      discount,
      gst,
      subtotal,
      taxable,
      gstAmount,
      cgst: half,
      sgst: half,
      total: taxable + gstAmount,
    };
  }

  function openInvoice() {
    setForm({
      invoiceNo:
        "INV-" +
        String(data.invoices.length + 1).padStart(4, "0"),
      customerName: "",
      customerPhone: "",
      productName: "",
      quantity: "1",
      rate: "",
      discount: "0",
      gst: "18",
      paymentMode: "Credit",
      note: "",
      date: today(),
    });

    setModal("invoice");
  }

  function saveInvoice() {
    if (!String(form.customerName || "").trim()) {
      Alert.alert("Customer", "Customer name enter karein.");
      return;
    }

    if (!String(form.productName || "").trim()) {
      Alert.alert("Product", "Product name enter karein.");
      return;
    }

    const c = calculateInvoice();

    if (!c.rate || c.total <= 0) {
      Alert.alert("Amount", "Valid product rate enter karein.");
      return;
    }

    const invoice = {
      id: uid("invoice"),
      invoiceNo: form.invoiceNo,
      customerName: form.customerName,
      customerPhone: form.customerPhone || "",
      productName: form.productName,
      quantity: c.qty,
      rate: c.rate,
      discount: c.discount,
      gst: c.gst,
      subtotal: c.subtotal,
      taxable: c.taxable,
      cgst: c.cgst,
      sgst: c.sgst,
      gstAmount: c.gstAmount,
      total: c.total,
      paymentMode: form.paymentMode,
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    update((old) => ({
      ...old,
      invoices: [invoice, ...old.invoices],
      transactions: [
        {
          id: uid("tx"),
          partyId: "",
          partyType: "customer",
          partyName: invoice.customerName,
          type: "sale",
          amount: invoice.total,
          paymentMode: invoice.paymentMode,
          reference: invoice.invoiceNo,
          note: invoice.productName,
          date: invoice.date,
          createdAt: Date.now(),
        },
        ...old.transactions,
      ],
    }));

    setModal("");
    Alert.alert(
      "Invoice Created",
      `${invoice.invoiceNo}\nTotal: ${money(invoice.total)}`
    );
  }

  /* ---------------- ESTIMATE ---------------- */

  function openEstimate() {
    setForm({
      estimateNo:
        "EST-" +
        String(data.estimates.length + 1).padStart(4, "0"),
      customerName: "",
      productName: "",
      quantity: "1",
      rate: "",
      discount: "0",
      gst: "18",
      note: "",
      date: today(),
    });

    setModal("estimate");
  }

  function saveEstimate() {
    const qty = num(form.quantity) || 1;
    const rate = num(form.rate);
    const discount = num(form.discount);
    const gst = num(form.gst);

    if (!form.customerName || !form.productName || !rate) {
      Alert.alert(
        "Required",
        "Customer, product aur rate enter karein."
      );
      return;
    }

    const subtotal = qty * rate;
    const taxable = Math.max(subtotal - discount, 0);
    const gstAmount = taxable * gst / 100;
    const total = taxable + gstAmount;

    const estimate = {
      id: uid("estimate"),
      estimateNo: form.estimateNo,
      customerName: form.customerName,
      productName: form.productName,
      quantity: qty,
      rate,
      discount,
      gst,
      subtotal,
      gstAmount,
      total,
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    update((old) => ({
      ...old,
      estimates: [estimate, ...old.estimates],
    }));

    setModal("");
    Alert.alert(
      "Estimate Created",
      `${estimate.estimateNo}\nTotal: ${money(total)}`
    );
  }

  /* ---------------- EXPENSE ---------------- */

  function openExpense() {
    setForm({
      title: "",
      amount: "",
      category: "",
      paymentMode: "Cash",
      note: "",
      date: today(),
    });

    setModal("expense");
  }

  function saveExpense() {
    if (!form.title || !num(form.amount)) {
      Alert.alert("Required", "Expense name aur amount enter karein.");
      return;
    }

    const expense = {
      id: uid("expense"),
      title: form.title,
      amount: num(form.amount),
      category: form.category || "General",
      paymentMode: form.paymentMode || "Cash",
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    update((old) => ({
      ...old,
      expenses: [expense, ...old.expenses],
    }));

    setModal("");
    Alert.alert("Saved", "Expense saved.");
  }

  /* ---------------- WHATSAPP ---------------- */

  async function whatsapp(party) {
    if (!party.phone) {
      Alert.alert("Phone", "Phone number available nahi hai.");
      return;
    }

    let phone = String(party.phone).replace(/\D/g, "");

    if (phone.length === 10) phone = "91" + phone;

    const b = balance(party);

    const message =
      `Namaste ${party.name},\n\n` +
      `${data.business.name}\n` +
      `Current Balance: ${money(Math.abs(b))}\n\n` +
      `Please check your account.\nThank you.`;

    try {
      await Linking.openURL(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      );
    } catch {
      Alert.alert("WhatsApp", "WhatsApp open nahi ho saka.");
    }
  }

  async function call(party) {
    if (!party.phone) return;

    try {
      await Linking.openURL(
        `tel:${String(party.phone).replace(/[^0-9+]/g, "")}`
      );
    } catch {}
  }

  /* ---------------- BUSINESS ---------------- */

  function openBusiness() {
    setForm({ ...data.business });
    setModal("business");
  }

  function saveBusiness() {
    update((old) => ({
      ...old,
      business: {
        ...old.business,
        name: form.name || "Vyapar Khata",
        phone: form.phone || "",
        address: form.address || "",
        gst: form.gst || "",
        state: form.state || "",
      },
    }));

    setModal("");
  }

  /* ---------------- PIN ---------------- */

  function openPin() {
    setForm({ newPin: "" });
    setModal("pin");
  }

  async function savePin() {
    if (!/^\d{4,6}$/.test(String(form.newPin || ""))) {
      Alert.alert("PIN", "4-6 digit PIN enter karein.");
      return;
    }

    await AsyncStorage.setItem(PIN_KEY, form.newPin);

    setSavedPin(form.newPin);
    setLocked(false);
    setModal("");

    Alert.alert("Success", "PIN saved.");
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
    Alert.alert("Remove PIN", "PIN remove karna hai?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(PIN_KEY);
          setSavedPin("");
        },
      },
    ]);
  }

  /* ---------------- BACKUP ---------------- */

  async function createBackup() {
    try {
      await AsyncStorage.setItem(
        BACKUP_KEY,
        JSON.stringify(data)
      );

      Alert.alert(
        "Backup Ready",
        "Aapka latest business data local backup mein save hai."
      );
    } catch {
      Alert.alert("Backup", "Backup failed.");
    }
  }

  /* ---------------- HOME ---------------- */

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
            <Text style={styles.sub}>
              Smart Business Management
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={openBusiness}
          >
            <Text style={{ fontSize: 21 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <Card title="Receivable" value={money(receivable)} />
          <Card title="Payable" value={money(payable)} />
          <Card title="Sales" value={money(sales)} />
          <Card title="Profit" value={money(estimatedProfit)} />
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title="＋ Customer"
            onPress={() => openParty("customer")}
          />
          <BigButton
            title="＋ Supplier"
            light
            onPress={() => openParty("supplier")}
          />
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title="🧾 Invoice"
            onPress={openInvoice}
          />
          <BigButton
            title="📋 Estimate"
            light
            onPress={openEstimate}
          />
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title="📦 Products"
            onPress={() => setPage("products")}
          />
          <BigButton
            title="📊 Reports"
            light
            onPress={() => setPage("reports")}
          />
        </View>

        <TouchableOpacity
          style={styles.expense}
          onPress={openExpense}
        >
          <Text style={styles.bold}>
            ＋ Add Business Expense
          </Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Parties</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === "customers" && styles.activeTab,
            ]}
            onPress={() => setTab("customers")}
          >
            <Text style={styles.bold}>
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
            <Text style={styles.bold}>
              Suppliers ({data.suppliers.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          placeholder="🔎 Search name or phone"
          value={search}
          onChangeText={setSearch}
        />

        {list.map((p) => {
          const type =
            tab === "customers"
              ? "customer"
              : "supplier";

          const b = balance({ ...p, type });

          return (
            <TouchableOpacity
              key={p.id}
              style={styles.party}
              onPress={() => {
                setSelected({ ...p, type });
                setPage("party");
              }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(p.name || "?")[0].toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.partyName}>
                  {p.name}
                </Text>
                <Text style={styles.muted}>
                  {p.phone || "No phone"}
                </Text>
              </View>

              <Text
                style={[
                  styles.amount,
                  b > 0 ? styles.red : styles.green,
                ]}
              >
                {money(Math.abs(b))}
              </Text>
            </TouchableOpacity>
          );
        })}

        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 42 }}>👥</Text>
            <Text style={styles.bold}>
              No parties yet
            </Text>
            <Text style={styles.muted}>
              Add customer or supplier from above.
            </Text>
          </View>
        )}

        <View style={styles.stats}>
          <Text style={styles.cardTitle}>
            Business Summary
          </Text>

          <Row title="Received" value={money(received)} />
          <Row title="Given" value={money(given)} />
          <Row title="Purchases" value={money(purchases)} />
          <Row title="Expenses" value={money(expenses)} />
          <Row
            title="Estimated Profit"
            value={money(estimatedProfit)}
          />
        </View>

        <Text style={styles.heading}>
          Recent Activity
        </Text>

        {data.transactions.slice(0, 8).map((t) => (
          <View style={styles.transaction} key={t.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>
                {t.partyName}
              </Text>
              <Text style={styles.muted}>
                {transactionTitle(t.type)}
              </Text>
              <Text style={styles.small}>
                {t.date}
              </Text>
            </View>

            <Text style={styles.amount}>
              {money(t.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  /* ---------------- PARTY PAGE ---------------- */

  function renderParty() {
    if (!selected) return null;

    const b = balance(selected);

    const tx = data.transactions.filter(
      (x) =>
        x.partyId === selected.id &&
        x.partyType === selected.type
    );

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          onPress={() => {
            setPage("home");
            setSelected(null);
          }}
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.profile}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>
              {(selected.name || "?")[0].toUpperCase()}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {selected.name}
          </Text>

          <Text style={styles.muted}>
            {selected.phone || "No phone"}
          </Text>

          {selected.email ? (
            <Text style={styles.muted}>
              {selected.email}
            </Text>
          ) : null}

          {selected.address ? (
            <Text style={styles.muted}>
              {selected.address}
            </Text>
          ) : null}

          <Text style={styles.muted}>
            Current Balance
          </Text>

          <Text
            style={[
              styles.bigBalance,
              b > 0 ? styles.red : styles.green,
            ]}
          >
            {money(Math.abs(b))}
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title="+ Received"
            onPress={() =>
              openPayment("received", selected)
            }
          />
          <BigButton
            title="- Given"
            light
            onPress={() =>
              openPayment("given", selected)
            }
          />
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title={
              selected.type === "customer"
                ? "+ Sale"
                : "+ Purchase"
            }
            onPress={() =>
              openSale(
                selected.type === "customer"
                  ? "sale"
                  : "purchase"
              )
            }
          />

          <BigButton
            title="✏️ Edit"
            light
            onPress={() =>
              openParty(selected.type, selected)
            }
          />
        </View>

        <View style={styles.actionGrid}>
          <BigButton
            title="📞 Call"
            light
            onPress={() => call(selected)}
          />

          <BigButton
            title="💬 WhatsApp"
            onPress={() => whatsapp(selected)}
          />
        </View>

        <Text style={styles.heading}>Ledger</Text>

        {tx.map((t) => (
          <View style={styles.transaction} key={t.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>
                {transactionTitle(t.type)}
              </Text>
              <Text style={styles.muted}>
                {t.note || t.paymentMode}
              </Text>
              <Text style={styles.small}>
                {t.date}
                {t.reference
                  ? ` • ${t.reference}`
                  : ""}
              </Text>
            </View>

            <Text style={styles.amount}>
              {money(t.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  /* ---------------- PRODUCTS ---------------- */

  function renderProducts() {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setPage("home")}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.pageHeader}>
          <Text style={styles.heading}>Products & Stock</Text>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => openProduct()}
          >
            <Text style={styles.whiteBold}>＋ Product</Text>
          </TouchableOpacity>
        </View>

        {data.products.map((p) => (
          <TouchableOpacity
            style={styles.product}
            key={p.id}
            onPress={() => openProduct(p)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{p.name}</Text>

              <Text style={styles.muted}>
                SKU: {p.sku || "-"}
              </Text>

              <Text style={styles.muted}>
                Sale: {money(p.sellingPrice)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.bold,
                  p.stock <= p.lowStock
                    ? styles.red
                    : styles.green,
                ]}
              >
                Stock: {p.stock}
              </Text>

              <Text style={styles.muted}>
                GST {p.gst}%
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {data.products.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 42 }}>📦</Text>
            <Text style={styles.bold}>
              No products
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  /* ---------------- REPORTS ---------------- */

  function renderReports() {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setPage("home")}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>
          Business Reports
        </Text>

        <Card title="Total Sales" value={money(sales)} />
        <Card
          title="Total Purchases"
          value={money(purchases)}
        />
        <Card
          title="Total Received"
          value={money(received)}
        />
        <Card
          title="Total Given"
          value={money(given)}
        />
        <Card
          title="Total Expenses"
          value={money(expenses)}
        />
        <Card
          title="Estimated Profit"
          value={money(estimatedProfit)}
        />

        <View style={styles.stats}>
          <Text style={styles.cardTitle}>
            Documents
          </Text>

          <Row
            title="Invoices"
            value={String(data.invoices.length)}
          />

          <Row
            title="Estimates"
            value={String(data.estimates.length)}
          />

          <Row
            title="Products"
            value={String(data.products.length)}
          />

          <Row
            title="Customers"
            value={String(data.customers.length)}
          />

          <Row
            title="Suppliers"
            value={String(data.suppliers.length)}
          />
        </View>

        <TouchableOpacity
          style={styles.backup}
          onPress={createBackup}
        >
          <Text style={styles.whiteBold}>
            💾 Create Local Backup
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* ---------------- MODALS ---------------- */

  function renderModal() {
    if (!modal) return null;

    const party =
      modal === "customer" ||
      modal === "supplier" ||
      modal === "editParty";

    const invoiceCalc =
      modal === "invoice"
        ? calculateInvoice()
        : null;

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => setModal("")}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {party
                  ? modal === "editParty"
                    ? "Edit Party"
                    : modal === "customer"
                    ? "Add Customer"
                    : "Add Supplier"
                  : modal === "product" ||
                    modal === "editProduct"
                  ? "Product"
                  : modal === "invoice"
                  ? "Create GST Invoice"
                  : modal === "estimate"
                  ? "Create Estimate"
                  : modal === "expense"
                  ? "Add Expense"
                  : modal === "received"
                  ? "Payment Received"
                  : modal === "given"
                  ? "Payment Given"
                  : modal === "sale"
                  ? "Sale"
                  : modal === "purchase"
                  ? "Purchase"
                  : modal === "business"
                  ? "Business Profile"
                  : "App PIN"}
              </Text>

              <TouchableOpacity
                onPress={() => setModal("")}
              >
                <Text style={{ fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {party && (
                <>
                  {!form.id && (
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={chooseContact}
                    >
                      <Text style={styles.whiteBold}>
                        👤 Choose from Phone Contacts
                      </Text>
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
                    placeholder="Phone"
                    keyboardType="phone-pad"
                  />

                  <Field
                    label="Email"
                    value={form.email}
                    onChangeText={(v) =>
                      setForm({ ...form, email: v })
                    }
                    placeholder="Email"
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
                    label="GSTIN"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({ ...form, gst: v })
                    }
                    placeholder="GSTIN"
                  />

                  <Field
                    label="Opening Balance"
                    value={form.openingBalance}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        openingBalance: v,
                      })
                    }
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Save
                    title={form.id ? "Update Party" : "Save Party"}
                    onPress={saveParty}
                  />
                </>
              )}

              {(modal === "received" ||
                modal === "given" ||
                modal === "sale" ||
                modal === "purchase") && (
                <>
                  <Field
                    label="Amount"
                    value={form.amount}
                    onChangeText={(v) =>
                      setForm({ ...form, amount: v })
                    }
                    placeholder="Amount"
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>
                    Payment Mode
                  </Text>

                  <View style={styles.choices}>
                    {["Cash", "UPI", "Bank", "Cheque", "Credit"].map(
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
                    placeholder="Reference / UTR"
                  />

                  <Field
                    label="Note"
                    value={form.note}
                    onChangeText={(v) =>
                      setForm({ ...form, note: v })
                    }
                    placeholder="Note"
                  />

                  <Field
                    label="Date"
                    value={form.date}
                    onChangeText={(v) =>
                      setForm({ ...form, date: v })
                    }
                    placeholder="DD/MM/YYYY"
                  />

                  <Save
                    title="Save Transaction"
                    onPress={
                      modal === "received" ||
                      modal === "given"
                        ? savePayment
                        : saveSale
                    }
                  />
                </>
              )}

              {(modal === "product" ||
                modal === "editProduct") && (
                <>
                  <Field
                    label="Product Name"
                    value={form.name}
                    onChangeText={(v) =>
                      setForm({ ...form, name: v })
                    }
                    placeholder="Product name"
                  />

                  <Field
                    label="SKU / Code"
                    value={form.sku}
                    onChangeText={(v) =>
                      setForm({ ...form, sku: v })
                    }
                    placeholder="SKU"
                  />

                  <Field
                    label="Category"
                    value={form.category}
                    onChangeText={(v) =>
                      setForm({ ...form, category: v })
                    }
                    placeholder="Category"
                  />

                  <Field
                    label="Purchase Price"
                    value={form.purchasePrice}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        purchasePrice: v,
                      })
                    }
                    placeholder="Purchase price"
                    keyboardType="numeric"
                  />

                  <Field
                    label="Selling Price"
                    value={form.sellingPrice}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        sellingPrice: v,
                      })
                    }
                    placeholder="Selling price"
                    keyboardType="numeric"
                  />

                  <Field
                    label="Stock Quantity"
                    value={form.stock}
                    onChangeText={(v) =>
                      setForm({ ...form, stock: v })
                    }
                    placeholder="Stock"
                    keyboardType="numeric"
                  />

                  <Field
                    label="Low Stock Alert"
                    value={form.lowStock}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        lowStock: v,
                      })
                    }
                    placeholder="5"
                    keyboardType="numeric"
                  />

                  <Field
                    label="GST %"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({ ...form, gst: v })
                    }
                    placeholder="18"
                    keyboardType="numeric"
                  />

                  <Save
                    title="Save Product"
                    onPress={saveProduct}
                  />
                </>
              )}

              {modal === "invoice" && (
                <>
                  <Field
                    label="Invoice Number"
                    value={form.invoiceNo}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        invoiceNo: v,
                      })
                    }
                    placeholder="INV-0001"
                  />

                  <Field
                    label="Customer Name"
                    value={form.customerName}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        customerName: v,
                      })
                    }
                    placeholder="Customer"
                  />

                  <Field
                    label="Customer Phone"
                    value={form.customerPhone}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        customerPhone: v,
                      })
                    }
                    placeholder="Phone"
                    keyboardType="phone-pad"
                  />

                  <Field
                    label="Product / Service"
                    value={form.productName}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        productName: v,
                      })
                    }
                    placeholder="Product"
                  />

                  <Field
                    label="Quantity"
                    value={form.quantity}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        quantity: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  <Field
                    label="Rate"
                    value={form.rate}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        rate: v,
                      })
                    }
                    placeholder="Rate"
                    keyboardType="numeric"
                  />

                  <Field
                    label="Discount"
                    value={form.discount}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        discount: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  <Field
                    label="GST %"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        gst: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  {invoiceCalc && (
                    <View style={styles.invoicePreview}>
                      <Row
                        title="Subtotal"
                        value={money(invoiceCalc.subtotal)}
                      />
                      <Row
                        title="Taxable"
                        value={money(invoiceCalc.taxable)}
                      />
                      <Row
                        title="CGST"
                        value={money(invoiceCalc.cgst)}
                      />
                      <Row
                        title="SGST"
                        value={money(invoiceCalc.sgst)}
                      />
                      <Row
                        title="Grand Total"
                        value={money(invoiceCalc.total)}
                      />
                    </View>
                  )}

                  <Save
                    title="Create GST Invoice"
                    onPress={saveInvoice}
                  />
                </>
              )}

              {modal === "estimate" && (
                <>
                  <Field
                    label="Estimate Number"
                    value={form.estimateNo}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        estimateNo: v,
                      })
                    }
                  />

                  <Field
                    label="Customer"
                    value={form.customerName}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        customerName: v,
                      })
                    }
                  />

                  <Field
                    label="Product / Service"
                    value={form.productName}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        productName: v,
                      })
                    }
                  />

                  <Field
                    label="Quantity"
                    value={form.quantity}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        quantity: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  <Field
                    label="Rate"
                    value={form.rate}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        rate: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  <Field
                    label="Discount"
                    value={form.discount}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        discount: v,
                      })
                    }
                    keyboardType="numeric"
                  />

                  <Field
                    label="GST %"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        gst: v,
                      })
                    }
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
                  />

                  <Save
                    title="Create Estimate"
                    onPress={saveEstimate}
                  />
                </>
              )}

              {modal === "expense" && (
                <>
                  <Field
                    label="Expense Name"
                    value={form.title}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        title: v,
                      })
                    }
                    placeholder="Rent, electricity, transport..."
                  />

                  <Field
                    label="Category"
                    value={form.category}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        category: v,
                      })
                    }
                    placeholder="Business"
                  />

                  <Field
                    label="Amount"
                    value={form.amount}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        amount: v,
                      })
                    }
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
                  />

                  <Save
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
                      setForm({ ...form, name: v })
                    }
                  />

                  <Field
                    label="Phone"
                    value={form.phone}
                    onChangeText={(v) =>
                      setForm({ ...form, phone: v })
                    }
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
                  />

                  <Field
                    label="GSTIN"
                    value={form.gst}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        gst: v,
                      })
                    }
                  />

                  <Field
                    label="State"
                    value={form.state}
                    onChangeText={(v) =>
                      setForm({
                        ...form,
                        state: v,
                      })
                    }
                  />

                  <Save
                    title="Save Business"
                    onPress={saveBusiness}
                  />
                </>
              )}

              {modal === "pin" && (
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
                    keyboardType="numeric"
                    secureTextEntry
                  />

                  <Save
                    title="Save PIN"
                    onPress={savePin}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.brand}>Vyapar Khata</Text>
        <Text>Loading business data...</Text>
      </SafeAreaView>
    );
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.lock}>
        <Text style={{ fontSize: 55 }}>🔐</Text>

        <Text style={styles.brand}>
          Vyapar Khata
        </Text>

        <Text style={styles.muted}>
          Enter PIN to continue
        </Text>

        <TextInput
          style={styles.pin}
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          placeholder="PIN"
        />

        <TouchableOpacity
          style={styles.save}
          onPress={unlock}
        >
          <Text style={styles.whiteBold}>
            Unlock
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {page === "home" && renderHome()}
      {page === "party" && renderParty()}
      {page === "products" && renderProducts()}
      {page === "reports" && renderReports()}

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => {
            setPage("home");
            setSelected(null);
          }}
        >
          <Text>🏠</Text>
          <Text style={styles.small}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => setPage("products")}
        >
          <Text>📦</Text>
          <Text style={styles.small}>Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={openInvoice}
        >
          <Text>🧾</Text>
          <Text style={styles.small}>Invoice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => setPage("reports")}
        >
          <Text>📊</Text>
          <Text style={styles.small}>Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={openPin}
        >
          <Text>🔐</Text>
          <Text style={styles.small}>PIN</Text>
        </TouchableOpacity>
      </View>

      {renderModal()}
    </SafeAreaView>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Card({ title, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.muted}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function Row({ title, value }) {
  return (
    <View style={styles.row}>
      <Text>{title}</Text>
      <Text style={styles.bold}>{value}</Text>
    </View>
  );
}

function BigButton({ title, onPress, light }) {
  return (
    <TouchableOpacity
      style={[
        styles.bigButton,
        light && styles.lightButton,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.bold,
          !light && styles.whiteBold,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
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
      <Text style={styles.label}>{label}</Text>

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
        style={
          active
            ? styles.choiceActiveText
            : styles.bold
        }
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function Save({ title, onPress }) {
  return (
    <TouchableOpacity
      style={styles.save}
      onPress={onPress}
    >
      <Text style={styles.whiteBold}>{title}</Text>
    </TouchableOpacity>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  content: {
    padding: 16,
    paddingBottom: 110,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f7fb",
  },

  lock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#f4f7fb",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  brand: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
  },

  sub: {
    color: "#718096",
    marginTop: 3,
  },

  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 17,
    marginBottom: 12,
    elevation: 2,
  },

  cardValue: {
    fontSize: 19,
    fontWeight: "900",
    marginTop: 7,
  },

  actionGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  bigButton: {
    flex: 1,
    backgroundColor: "#167a46",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  lightButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde3e8",
  },

  expense: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde3e8",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 22,
  },

  heading: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#e7ecf1",
    borderRadius: 13,
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

  search: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 13,
    borderWidth: 1,
    borderColor: "#dde3e8",
    marginBottom: 10,
  },

  party: {
    backgroundColor: "#fff",
    padding: 13,
    borderRadius: 15,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#e5f4eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    color: "#167a46",
    fontSize: 19,
    fontWeight: "900",
  },

  partyName: {
    fontSize: 16,
    fontWeight: "900",
  },

  amount: {
    fontSize: 16,
    fontWeight: "900",
  },

  red: {
    color: "#d32f2f",
  },

  green: {
    color: "#168653",
  },

  muted: {
    color: "#718096",
    marginTop: 3,
  },

  small: {
    color: "#999",
    fontSize: 11,
    marginTop: 3,
  },

  bold: {
    fontWeight: "800",
  },

  whiteBold: {
    color: "#fff",
    fontWeight: "900",
  },

  empty: {
    alignItems: "center",
    padding: 35,
  },

  stats: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginVertical: 15,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
  },

  transaction: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  back: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 15,
  },

  profile: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
  },

  bigAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#e5f4eb",
    alignItems: "center",
    justifyContent: "center",
  },

  bigAvatarText: {
    color: "#167a46",
    fontSize: 29,
    fontWeight: "900",
  },

  profileName: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },

  bigBalance: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  smallButton: {
    backgroundColor: "#167a46",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 11,
  },

  product: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 9,
    flexDirection: "row",
  },

  backup: {
    backgroundColor: "#167a46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 15,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e4e8ec",
    flexDirection: "row",
    paddingVertical: 9,
  },

  bottomItem: {
    flex: 1,
    alignItems: "center",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.48)",
    justifyContent: "flex-end",
  },

  modal: {
    backgroundColor: "#f6f8fa",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: "94%",
    padding: 18,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "900",
  },

  contactButton: {
    backgroundColor: "#167a46",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 15,
  },

  field: {
    marginBottom: 12,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4e8",
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
  },

  choices: {
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

  choiceActiveText: {
    color: "#fff",
    fontWeight: "900",
  },

  save: {
    backgroundColor: "#167a46",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 6,
  },

  invoicePreview: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 15,
  },

  pin: {
    width: "80%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 13,
    padding: 15,
    textAlign: "center",
    fontSize: 22,
    marginTop: 20,
  },
});
