import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DATA_KEY = "@vyapar_khata_market_v5";

const emptyData = {
  business: {
    name: "My Business",
    owner: "",
    phone: "",
    upi: "",
    gstin: "",
  },
  customers: [],
  suppliers: [],
  products: [],
  transactions: [],
  expenses: [],
};

const money = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("Home");

  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (loaded) saveData();
  }, [data, loaded]);

  async function loadData() {
    try {
      const raw = await AsyncStorage.getItem(DATA_KEY);

      if (raw) {
        const saved = JSON.parse(raw);

        setData({
          ...emptyData,
          ...saved,
          business: {
            ...emptyData.business,
            ...(saved.business || {}),
          },
        });
      }
    } catch (e) {
      Alert.alert("Error", "Data load nahi ho saka.");
    }

    setLoaded(true);
  }

  async function saveData() {
    await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function updateForm(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function openAdd(type) {
    setSelected(null);
    setForm({});
    setModal(type);
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setForm({});
  }

  function addCustomer() {
    if (!form.name?.trim()) {
      Alert.alert("Name required", "Customer ka naam likhiye.");
      return;
    }

    const item = {
      id: Date.now().toString(),
      name: form.name.trim(),
      phone: form.phone || "",
      address: form.address || "",
      balance: Number(form.balance || 0),
    };

    setData((p) => ({
      ...p,
      customers: [...p.customers, item],
    }));

    closeModal();
  }

  function addSupplier() {
    if (!form.name?.trim()) {
      Alert.alert("Name required", "Supplier ka naam likhiye.");
      return;
    }

    const item = {
      id: Date.now().toString(),
      name: form.name.trim(),
      phone: form.phone || "",
      balance: Number(form.balance || 0),
    };

    setData((p) => ({
      ...p,
      suppliers: [...p.suppliers, item],
    }));

    closeModal();
  }

  function addProduct() {
    if (!form.name?.trim()) {
      Alert.alert("Product required", "Product name likhiye.");
      return;
    }

    const item = {
      id: Date.now().toString(),
      name: form.name.trim(),
      sku: form.sku || "",
      buy: Number(form.buy || 0),
      sell: Number(form.sell || 0),
      stock: Number(form.stock || 0),
      low: Number(form.low || 5),
    };

    setData((p) => ({
      ...p,
      products: [...p.products, item],
    }));

    closeModal();
  }

  function addTransaction() {
    if (!form.amount || Number(form.amount) <= 0) {
      Alert.alert("Amount required", "Valid amount enter kijiye.");
      return;
    }

    const item = {
      id: Date.now().toString(),
      date: today(),
      type: form.type || "sale",
      party: form.party || "Walk-in Customer",
      amount: Number(form.amount),
      note: form.note || "",
    };

    setData((p) => ({
      ...p,
      transactions: [item, ...p.transactions],
    }));

    closeModal();
  }

  function addExpense() {
    if (!form.amount || Number(form.amount) <= 0) {
      Alert.alert("Amount required", "Expense amount enter kijiye.");
      return;
    }

    const item = {
      id: Date.now().toString(),
      date: today(),
      category: form.category || "Other",
      amount: Number(form.amount),
      note: form.note || "",
    };

    setData((p) => ({
      ...p,
      expenses: [item, ...p.expenses],
    }));

    closeModal();
  }

  function deleteItem(collection, id) {
    Alert.alert("Delete", "Kya aap ise delete karna chahte hain?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setData((p) => ({
            ...p,
            [collection]: p[collection].filter((x) => x.id !== id),
          }));
        },
      },
    ]);
  }

  function updateBusiness() {
    setData((p) => ({
      ...p,
      business: {
        ...p.business,
        name: form.name || p.business.name,
        owner: form.owner || "",
        phone: form.phone || "",
        upi: form.upi || "",
        gstin: form.gstin || "",
      },
    }));

    closeModal();
  }

  function sendWhatsApp(phone, message) {
    if (!phone) {
      Alert.alert("Phone missing", "Customer ka phone number add kijiye.");
      return;
    }

    const clean = String(phone).replace(/\D/g, "");
    const number = clean.length === 10 ? "91" + clean : clean;

    Linking.openURL(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    ).catch(() => {
      Alert.alert("WhatsApp", "WhatsApp open nahi ho saka.");
    });
  }

  const stats = useMemo(() => {
    let sales = 0;
    let purchases = 0;
    let received = 0;
    let given = 0;

    data.transactions.forEach((t) => {
      if (t.type === "sale") sales += t.amount;
      if (t.type === "purchase") purchases += t.amount;
      if (t.type === "received") received += t.amount;
      if (t.type === "given") given += t.amount;
    });

    const expenses = data.expenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );

    const stockValue = data.products.reduce(
      (sum, p) => sum + Number(p.stock || 0) * Number(p.buy || 0),
      0
    );

    const receivable = data.customers.reduce(
      (sum, c) => sum + Number(c.balance || 0),
      0
    );

    const payable = data.suppliers.reduce(
      (sum, s) => sum + Number(s.balance || 0),
      0
    );

    const profit = sales - purchases - expenses;

    return {
      sales,
      purchases,
      received,
      given,
      expenses,
      stockValue,
      receivable,
      payable,
      profit,
    };
  }, [data]);

  const lowStock = data.products.filter(
    (p) => Number(p.stock) <= Number(p.low)
  );

  const healthScore = useMemo(() => {
    let score = 50;

    if (stats.profit > 0) score += 15;
    if (stats.sales > stats.purchases) score += 10;
    if (lowStock.length === 0) score += 10;
    if (data.customers.length >= 5) score += 5;
    if (stats.receivable < stats.sales * 0.5 || stats.sales === 0) score += 5;
    if (data.products.length >= 5) score += 5;

    return Math.max(0, Math.min(100, score));
  }, [stats, lowStock, data]);

  function advisorMessage() {
    if (stats.sales === 0) {
      return "Abhi sales record nahi hui. Daily sales entry maintain karke business trend dekhiye.";
    }

    if (lowStock.length > 0) {
      return `${lowStock.length} product low stock par hain. Reorder karne se stock-out ka risk kam hoga.`;
    }

    if (stats.receivable > stats.sales * 0.5) {
      return "Customer outstanding high hai. Pending payments ke liye WhatsApp reminder bhejiye.";
    }

    if (stats.profit > 0) {
      return "Business positive profit dikha raha hai. High-margin products par focus kijiye.";
    }

    return "Expenses aur purchase cost ko monitor karke margin improve karne ki koshish kijiye.";
  }

  function Card({ title, value, subtitle, onPress }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      </TouchableOpacity>
    );
  }

  function Button({ title, onPress, secondary }) {
    return (
      <TouchableOpacity
        style={[styles.button, secondary && styles.secondaryButton]}
        onPress={onPress}
      >
        <Text
          style={[
            styles.buttonText,
            secondary && styles.secondaryButtonText,
          ]}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  }

  function SectionTitle({ children }) {
    return <Text style={styles.sectionTitle}>{children}</Text>;
  }

  function Input({ label, field, placeholder, keyboardType }) {
    return (
      <View style={styles.inputWrap}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          value={form[field] || ""}
          onChangeText={(v) => updateForm(field, v)}
          placeholder={placeholder}
          keyboardType={keyboardType}
          placeholderTextColor="#999"
        />
      </View>
    );
  }

  function Home() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroSmall}>BUSINESS DASHBOARD</Text>
          <Text style={styles.heroTitle}>{data.business.name}</Text>
          <Text style={styles.heroSub}>
            {data.business.owner || "Your business at a glance"}
          </Text>
        </View>

        <View style={styles.grid}>
          <Card title="Today's Sales" value={money(stats.sales)} />
          <Card title="Profit" value={money(stats.profit)} />
          <Card title="Receivable" value={money(stats.receivable)} />
          <Card title="Payable" value={money(stats.payable)} />
        </View>

        <SectionTitle>Quick Actions</SectionTitle>

        <View style={styles.actionGrid}>
          <Button title="+ Sale" onPress={() => openAdd("transaction")} />
          <Button title="+ Purchase" onPress={() => {
            setForm({ type: "purchase" });
            setModal("transaction");
          }} />
          <Button title="+ Payment" onPress={() => {
            setForm({ type: "received" });
            setModal("transaction");
          }} />
          <Button title="+ Expense" onPress={() => openAdd("expense")} />
        </View>

        <SectionTitle>Business Health</SectionTitle>

        <View style={styles.healthCard}>
          <Text style={styles.healthNumber}>{healthScore}/100</Text>
          <Text style={styles.healthText}>
            {healthScore >= 75
              ? "Business is looking strong."
              : healthScore >= 55
              ? "Business is stable. Kuch areas improve ho sakte hain."
              : "Business ko close monitoring ki zarurat hai."}
          </Text>
        </View>

        <SectionTitle>Smart Advisor</SectionTitle>

        <View style={styles.advisor}>
          <Text style={styles.advisorIcon}>💡</Text>
          <Text style={styles.advisorText}>{advisorMessage()}</Text>
        </View>

        {lowStock.length > 0 && (
          <>
            <SectionTitle>Low Stock Alert</SectionTitle>
            {lowStock.slice(0, 5).map((p) => (
              <View style={styles.rowCard} key={p.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowSub}>
                    Stock: {p.stock} • Minimum: {p.low}
                  </Text>
                </View>
                <Text style={styles.warning}>LOW</Text>
              </View>
            ))}
          </>
        )}

        <SectionTitle>Recent Activity</SectionTitle>

        {data.transactions.slice(0, 5).map((t) => (
          <View style={styles.rowCard} key={t.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.party}</Text>
              <Text style={styles.rowSub}>
                {t.date} • {t.type}
              </Text>
            </View>
            <Text style={styles.amount}>{money(t.amount)}</Text>
          </View>
        ))}

        {data.transactions.length === 0 && (
          <Text style={styles.empty}>No transactions yet.</Text>
        )}
      </ScrollView>
    );
  }

  function Khata() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle>Customers</SectionTitle>

        <Button title="+ Add Customer" onPress={() => openAdd("customer")} />

        {data.customers.map((c) => (
          <View style={styles.partyCard} key={c.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{c.name}</Text>
              <Text style={styles.rowSub}>{c.phone || "No phone"}</Text>
              <Text
                style={[
                  styles.partyBalance,
                  c.balance > 0 && styles.dueText,
                ]}
              >
                Balance: {money(c.balance)}
              </Text>
            </View>

            <View style={styles.smallActions}>
              {c.phone ? (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    sendWhatsApp(
                      c.phone,
                      `Namaste ${c.name}, aapke account ka pending balance ${money(
                        c.balance
                      )} hai. Kripya payment kar dein. - ${
                        data.business.name
                      }`
                    )
                  }
                >
                  <Text>WA</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteItem("customers", c.id)}
              >
                <Text>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {data.customers.length === 0 && (
          <Text style={styles.empty}>Customers add kijiye.</Text>
        )}

        <SectionTitle>Suppliers</SectionTitle>

        <Button title="+ Add Supplier" onPress={() => openAdd("supplier")} />

        {data.suppliers.map((s) => (
          <View style={styles.partyCard} key={s.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.name}</Text>
              <Text style={styles.rowSub}>{s.phone || "No phone"}</Text>
              <Text style={styles.partyBalance}>
                Payable: {money(s.balance)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteItem("suppliers", s.id)}
            >
              <Text>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  }

  function Stock() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.stockSummary}>
          <Text style={styles.cardTitle}>Stock Value</Text>
          <Text style={styles.bigMoney}>{money(stats.stockValue)}</Text>
          <Text style={styles.rowSub}>
            {data.products.length} products • {lowStock.length} low stock
          </Text>
        </View>

        <Button title="+ Add Product" onPress={() => openAdd("product")} />

        <SectionTitle>Products</SectionTitle>

        {data.products.map((p) => {
          const margin =
            Number(p.sell || 0) - Number(p.buy || 0);

          return (
            <View style={styles.productCard} key={p.id}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>

                <Text style={styles.rowSub}>
                  SKU: {p.sku || "-"}
                </Text>

                <Text style={styles.rowSub}>
                  Buy {money(p.buy)} • Sell {money(p.sell)}
                </Text>

                <Text style={styles.rowSub}>
                  Margin: {money(margin)} • Stock: {p.stock}
                </Text>
              </View>

              <View>
                {Number(p.stock) <= Number(p.low) && (
                  <Text style={styles.warning}>LOW</Text>
                )}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem("products", p.id)}
                >
                  <Text>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {data.products.length === 0 && (
          <Text style={styles.empty}>Products add kijiye.</Text>
        )}
      </ScrollView>
    );
  }

  function Reports() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle>Business Report</SectionTitle>

        <Card title="Sales" value={money(stats.sales)} />
        <Card title="Purchases" value={money(stats.purchases)} />
        <Card title="Expenses" value={money(stats.expenses)} />
        <Card title="Estimated Profit" value={money(stats.profit)} />
        <Card title="Stock Value" value={money(stats.stockValue)} />

        <SectionTitle>Cash Flow</SectionTitle>

        <View style={styles.reportBox}>
          <Text style={styles.reportLine}>
            Money Received{"\n"}
            <Text style={styles.reportValue}>
              {money(stats.received)}
            </Text>
          </Text>

          <Text style={styles.reportLine}>
            Money Given{"\n"}
            <Text style={styles.reportValue}>
              {money(stats.given)}
            </Text>
          </Text>

          <Text style={styles.reportLine}>
            Net Cash Flow{"\n"}
            <Text style={styles.reportValue}>
              {money(stats.received - stats.given)}
            </Text>
          </Text>
        </View>

        <SectionTitle>Expenses</SectionTitle>

        {data.expenses.slice(0, 20).map((e) => (
          <View style={styles.rowCard} key={e.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{e.category}</Text>
              <Text style={styles.rowSub}>
                {e.date} • {e.note || "Expense"}
              </Text>
            </View>

            <Text style={styles.amount}>{money(e.amount)}</Text>
          </View>
        ))}

        {data.expenses.length === 0 && (
          <Text style={styles.empty}>No expenses recorded.</Text>
        )}

        <Button
          title="+ Add Expense"
          onPress={() => openAdd("expense")}
        />
      </ScrollView>
    );
  }

  function Smart() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.smartHero}>
          <Text style={styles.smartTitle}>Smart Business Advisor</Text>
          <Text style={styles.smartSub}>
            Aapke local business data ke basis par simple insights.
          </Text>
        </View>

        <View style={styles.healthCard}>
          <Text style={styles.cardTitle}>Business Health Score</Text>
          <Text style={styles.healthNumber}>{healthScore}/100</Text>
        </View>

        <SectionTitle>Today's Insights</SectionTitle>

        <View style={styles.insight}>
          <Text style={styles.insightTitle}>💰 Profit</Text>
          <Text style={styles.insightText}>
            Current estimated profit: {money(stats.profit)}
          </Text>
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightTitle}>📦 Inventory</Text>
          <Text style={styles.insightText}>
            Stock value: {money(stats.stockValue)}
          </Text>
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightTitle}>👥 Outstanding</Text>
          <Text style={styles.insightText}>
            Customers se {money(stats.receivable)} receive karna hai.
          </Text>
        </View>

        <View style={styles.insight}>
          <Text style={styles.insightTitle}>⚠️ Action</Text>
          <Text style={styles.insightText}>{advisorMessage()}</Text>
        </View>

        <SectionTitle>Recommended Actions</SectionTitle>

        <Button
          title="Add Customer"
          onPress={() => openAdd("customer")}
        />

        <Button
          title="Add Product"
          onPress={() => openAdd("product")}
        />

        <Button
          title="Record Sale"
          onPress={() => openAdd("transaction")}
        />

        <Button
          title="Record Expense"
          onPress={() => openAdd("expense")}
        />
      </ScrollView>
    );
  }

  function Settings() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <SectionTitle>Business Profile</SectionTitle>

        <View style={styles.profileBox}>
          <Text style={styles.rowTitle}>{data.business.name}</Text>
          <Text style={styles.rowSub}>
            Owner: {data.business.owner || "-"}
          </Text>
          <Text style={styles.rowSub}>
            Phone: {data.business.phone || "-"}
          </Text>
          <Text style={styles.rowSub}>
            UPI: {data.business.upi || "-"}
          </Text>
          <Text style={styles.rowSub}>
            GSTIN: {data.business.gstin || "-"}
          </Text>
        </View>

        <Button
          title="Edit Business Profile"
          onPress={() => {
            setForm({ ...data.business });
            setModal("business");
          }}
        />

        <SectionTitle>App Data</SectionTitle>

        <Button
          title="Clear All Local Data"
          secondary
          onPress={() => {
            Alert.alert(
              "Clear Data",
              "Saara local business data delete ho jayega.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    setData(emptyData);
                    await AsyncStorage.removeItem(DATA_KEY);
                  },
                },
              ]
            );
          }}
        />
      </ScrollView>
    );
  }

  function ModalContent() {
    if (!modal) return null;

    let title = "";

    if (modal === "customer") title = "Add Customer";
    if (modal === "supplier") title = "Add Supplier";
    if (modal === "product") title = "Add Product";
    if (modal === "transaction") title = "New Transaction";
    if (modal === "expense") title = "Add Expense";
    if (modal === "business") title = "Business Profile";

    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView>
              <Text style={styles.modalTitle}>{title}</Text>

              {modal === "customer" && (
                <>
                  <Input label="Name" field="name" placeholder="Customer name" />
                  <Input
                    label="Phone"
                    field="phone"
                    placeholder="10 digit mobile"
                    keyboardType="phone-pad"
                  />
                  <Input
                    label="Address"
                    field="address"
                    placeholder="Address"
                  />
                  <Input
                    label="Opening Balance"
                    field="balance"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Button title="Save Customer" onPress={addCustomer} />
                </>
              )}

              {modal === "supplier" && (
                <>
                  <Input label="Name" field="name" placeholder="Supplier name" />
                  <Input
                    label="Phone"
                    field="phone"
                    placeholder="Mobile"
                    keyboardType="phone-pad"
                  />
                  <Input
                    label="Payable Balance"
                    field="balance"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Button title="Save Supplier" onPress={addSupplier} />
                </>
              )}

              {modal === "product" && (
                <>
                  <Input
                    label="Product Name"
                    field="name"
                    placeholder="Product name"
                  />

                  <Input
                    label="SKU"
                    field="sku"
                    placeholder="Optional SKU"
                  />

                  <Input
                    label="Purchase Price"
                    field="buy"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Input
                    label="Selling Price"
                    field="sell"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Input
                    label="Current Stock"
                    field="stock"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Input
                    label="Low Stock Alert At"
                    field="low"
                    placeholder="5"
                    keyboardType="numeric"
                  />

                  <Button title="Save Product" onPress={addProduct} />
                </>
              )}

              {modal === "transaction" && (
                <>
                  <Text style={styles.inputLabel}>Transaction Type</Text>

                  <View style={styles.typeRow}>
                    {[
                      ["sale", "Sale"],
                      ["purchase", "Purchase"],
                      ["received", "Received"],
                      ["given", "Given"],
                    ].map(([value, label]) => (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.typeButton,
                          (form.type || "sale") === value &&
                            styles.typeSelected,
                        ]}
                        onPress={() => updateForm("type", value)}
                      >
                        <Text>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Input
                    label="Party / Customer"
                    field="party"
                    placeholder="Name"
                  />

                  <Input
                    label="Amount"
                    field="amount"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Input
                    label="Note"
                    field="note"
                    placeholder="Optional note"
                  />

                  <Button
                    title="Save Transaction"
                    onPress={addTransaction}
                  />
                </>
              )}

              {modal === "expense" && (
                <>
                  <Input
                    label="Category"
                    field="category"
                    placeholder="Rent / Salary / Electricity"
                  />

                  <Input
                    label="Amount"
                    field="amount"
                    placeholder="0"
                    keyboardType="numeric"
                  />

                  <Input
                    label="Note"
                    field="note"
                    placeholder="Optional note"
                  />

                  <Button title="Save Expense" onPress={addExpense} />
                </>
              )}

              {modal === "business" && (
                <>
                  <Input
                    label="Business Name"
                    field="name"
                    placeholder="Business name"
                  />

                  <Input
                    label="Owner"
                    field="owner"
                    placeholder="Owner name"
                  />

                  <Input
                    label="Phone"
                    field="phone"
                    placeholder="Business phone"
                    keyboardType="phone-pad"
                  />

                  <Input
                    label="UPI ID"
                    field="upi"
                    placeholder="business@upi"
                  />

                  <Input
                    label="GSTIN"
                    field="gstin"
                    placeholder="Optional GSTIN"
                  />

                  <Button
                    title="Save Profile"
                    onPress={updateBusiness}
                  />
                </>
              )}

              <Button
                title="Cancel"
                secondary
                onPress={closeModal}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.loadingText}>Vyapar Khata loading...</Text>
      </SafeAreaView>
    );
  }

  let screen = <Home />;

  if (tab === "Khata") screen = <Khata />;
  if (tab === "Stock") screen = <Stock />;
  if (tab === "Reports") screen = <Reports />;
  if (tab === "Smart") screen = <Smart />;
  if (tab === "Settings") screen = <Settings />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>Vyapar Khata</Text>
          <Text style={styles.topSub}>
            {data.business.name}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setTab("Settings")}
        >
          <Text style={styles.settingsText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {screen}

      <View style={styles.bottom}>
        {[
          ["Home", "⌂"],
          ["Khata", "₹"],
          ["Stock", "▣"],
          ["Reports", "▤"],
          ["Smart", "✦"],
        ].map(([name, icon]) => (
          <TouchableOpacity
            key={name}
            style={styles.navItem}
            onPress={() => setTab(name)}
          >
            <Text
              style={[
                styles.navIcon,
                tab === name && styles.navActive,
              ]}
            >
              {icon}
            </Text>

            <Text
              style={[
                styles.navText,
                tab === name && styles.navActive,
              ]}
            >
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {ModalContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FB",
  },

  loadingText: {
    fontSize: 18,
    fontWeight: "700",
  },

  topBar: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDF3",
  },

  appName: {
    fontSize: 21,
    fontWeight: "800",
  },

  topSub: {
    color: "#777",
    marginTop: 2,
    fontSize: 12,
  },

  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },

  settingsText: {
    fontSize: 21,
  },

  container: {
    padding: 16,
    paddingBottom: 110,
  },

  hero: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
  },

  heroSmall: {
    color: "#AAB2C0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 7,
  },

  heroSub: {
    color: "#C7CDD8",
    marginTop: 5,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECEFF4",
  },

  cardTitle: {
    color: "#707784",
    fontSize: 12,
    fontWeight: "700",
  },

  cardValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
  },

  cardSub: {
    color: "#8B919B",
    marginTop: 5,
    fontSize: 11,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 18,
    marginBottom: 10,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  button: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: "center",
    minWidth: "47%",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  secondaryButton: {
    backgroundColor: "#EEF0F3",
  },

  secondaryButtonText: {
    color: "#222",
  },

  healthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9EDF3",
  },

  healthNumber: {
    fontSize: 38,
    fontWeight: "900",
    marginTop: 5,
  },

  healthText: {
    color: "#6D7480",
    textAlign: "center",
    marginTop: 6,
  },

  advisor: {
    backgroundColor: "#FFF8E7",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  advisorIcon: {
    fontSize: 23,
    marginRight: 10,
  },

  advisorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: "#574A22",
    fontWeight: "600",
  },

  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ECEFF4",
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },

  rowSub: {
    fontSize: 12,
    color: "#777F8B",
    marginTop: 4,
  },

  amount: {
    fontSize: 15,
    fontWeight: "900",
  },

  warning: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "900",
  },

  empty: {
    textAlign: "center",
    color: "#8A919C",
    paddingVertical: 20,
  },

  partyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ECEFF4",
  },

  partyBalance: {
    marginTop: 7,
    fontWeight: "800",
  },

  dueText: {
    color: "#B45309",
  },

  smallActions: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },

  iconButton: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
  },

  deleteButton: {
    backgroundColor: "#F3F4F6",
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  stockSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },

  bigMoney: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },

  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#ECEFF4",
  },

  reportBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },

  reportLine: {
    color: "#666",
    marginBottom: 16,
    lineHeight: 21,
  },

  reportValue: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  smartHero: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 22,
  },

  smartTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  smartSub: {
    color: "#C8CED8",
    marginTop: 7,
    lineHeight: 20,
  },

  insight: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ECEFF4",
  },

  insightTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  insightText: {
    color: "#626A75",
    marginTop: 7,
    lineHeight: 20,
  },

  profileBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },

  inputWrap: {
    marginBottom: 13,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#555C67",
    marginBottom: 6,
  },

  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE2E9",
    paddingHorizontal: 13,
    fontSize: 15,
    backgroundColor: "#FAFBFC",
    color: "#111827",
  },

  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
    gap: 7,
  },

  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F0F2F5",
  },

  typeSelected: {
    backgroundColor: "#DDE3ED",
    borderWidth: 1,
    borderColor: "#111827",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalBox: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: "92%",
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 18,
  },

  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E7EAF0",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 4,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
  },

  navIcon: {
    fontSize: 19,
    color: "#8A919C",
  },

  navText: {
    fontSize: 10,
    color: "#8A919C",
    marginTop: 3,
    fontWeight: "700",
  },

  navActive: {
    color: "#111827",
    fontWeight: "900",
  },
});
