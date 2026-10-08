
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";

const DATA_KEY = "@vyapar_khata_advanced_v1";
const PIN_KEY = "@vyapar_khata_pin_advanced_v1";

const EMPTY = {
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
  "₹" + Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const id = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 8);

const today = () => new Date().toISOString().slice(0, 10);

function App() {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home");
  const [modal, setModal] = useState(null);
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const d = await AsyncStorage.getItem(DATA_KEY);
      const p = await AsyncStorage.getItem(PIN_KEY);

      if (d) {
        setData({
          ...EMPTY,
          ...JSON.parse(d),
        });
      }

      if (p) setSavedPin(p);
    } catch (e) {
      Alert.alert("Error", "Data load nahi ho paya.");
    }

    setLoaded(true);
  }

  async function saveData(next) {
    setData(next);
    await AsyncStorage.setItem(DATA_KEY, JSON.stringify(next));
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.logo}>Vyapar Khata</Text>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (savedPin && pin !== savedPin) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.logo}>Vyapar Khata</Text>
        <Text style={styles.subtitle}>Enter PIN</Text>

        <TextInput
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={styles.pinInput}
          placeholder="PIN"
        />

        <Pressable style={styles.primary} onPress={() => {}}>
          <Text style={styles.primaryText}>Unlock</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totals = calculateTotals(data);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {data.business.name || "Vyapar Khata"}
          </Text>
          <Text style={styles.headerSub}>Smart Business Dashboard</Text>
        </View>

        <Pressable
          style={styles.iconButton}
          onPress={() => setModal("business")}
        >
          <Text>⚙️</Text>
        </Pressable>
      </View>

      {screen === "home" && (
        <Home
          data={data}
          totals={totals}
          go={setScreen}
          setModal={setModal}
        />
      )}

      {screen === "khata" && (
        <Khata
          data={data}
          saveData={saveData}
          setModal={setModal}
        />
      )}

      {screen === "products" && (
        <Products
          data={data}
          saveData={saveData}
          setModal={setModal}
        />
      )}

      {screen === "transactions" && (
        <Transactions
          data={data}
          totals={totals}
          saveData={saveData}
        />
      )}

      {screen === "reports" && (
        <Reports data={data} totals={totals} />
      )}

      {screen === "smart" && (
        <SmartAdvisor
          data={data}
          totals={totals}
          go={setScreen}
        />
      )}

      <View style={styles.bottom}>
        <Bottom
          current={screen}
          setScreen={setScreen}
        />
      </View>

      {modal === "business" && (
        <BusinessModal
          data={data}
          saveData={saveData}
          close={() => setModal(null)}
        />
      )}

      {modal === "party" && (
        <PartyModal
          data={data}
          saveData={saveData}
          close={() => setModal(null)}
        />
      )}

      {modal === "transaction" && (
        <TransactionModal
          data={data}
          saveData={saveData}
          close={() => setModal(null)}
        />
      )}

      {modal === "product" && (
        <ProductModal
          data={data}
          saveData={saveData}
          close={() => setModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

/* =========================================================
   CALCULATIONS
========================================================= */

function calculateTotals(data) {
  let sales = 0;
  let purchases = 0;
  let received = 0;
  let given = 0;
  let expenses = 0;
  let profit = 0;

  data.transactions.forEach((t) => {
    const amount = Number(t.amount || 0);

    if (t.type === "sale") sales += amount;
    if (t.type === "purchase") purchases += amount;
    if (t.type === "received") received += amount;
    if (t.type === "given") given += amount;
  });

  data.expenses.forEach((e) => {
    expenses += Number(e.amount || 0);
  });

  profit = sales - purchases - expenses;

  return {
    sales,
    purchases,
    received,
    given,
    expenses,
    profit,
    cash: received - given - expenses,
  };
}

function getPartyBalance(data, partyId) {
  let balance = 0;

  data.transactions.forEach((t) => {
    if (t.partyId !== partyId) return;

    const amount = Number(t.amount || 0);

    if (
      t.type === "sale" ||
      t.type === "given"
    ) {
      balance += amount;
    }

    if (
      t.type === "received" ||
      t.type === "purchase"
    ) {
      balance -= amount;
    }
  });

  return balance;
}

function getStockValue(data) {
  return data.products.reduce(
    (sum, p) =>
      sum +
      Number(p.stock || 0) * Number(p.cost || 0),
    0
  );
}

function healthScore(data, totals) {
  let score = 60;

  if (totals.profit > 0) score += 15;
  else score -= 15;

  if (totals.received >= totals.given) score += 10;
  else score -= 10;

  const lowStock = data.products.filter(
    (p) => Number(p.stock || 0) <= Number(p.minStock || 0)
  ).length;

  if (lowStock === 0) score += 10;
  else score -= Math.min(10, lowStock * 2);

  if (data.customers.length > 0) score += 5;

  return Math.max(0, Math.min(100, score));
}

/* =========================================================
   HOME
========================================================= */

function Home({ data, totals, go, setModal }) {
  const score = healthScore(data, totals);

  const pendingCustomers = data.customers
    .map((c) => ({
      ...c,
      balance: getPartyBalance(data, c.id),
    }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const lowStock = data.products.filter(
    (p) =>
      Number(p.stock || 0) <= Number(p.minStock || 0)
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroSmall}>
            BUSINESS HEALTH
          </Text>

          <Text style={styles.score}>
            {score}/100
          </Text>

          <Text style={styles.heroText}>
            {score >= 75
              ? "Business is looking strong 🚀"
              : score >= 50
              ? "Business needs attention"
              : "Some areas need action"}
          </Text>
        </View>

        <Text style={styles.heroEmoji}>
          {score >= 75 ? "🟢" : score >= 50 ? "🟡" : "🔴"}
        </Text>
      </View>

      <View style={styles.grid}>
        <Stat title="Sales" value={money(totals.sales)} />
        <Stat title="Purchase" value={money(totals.purchases)} />
        <Stat title="Expenses" value={money(totals.expenses)} />
        <Stat
          title="Profit"
          value={money(totals.profit)}
          positive={totals.profit >= 0}
        />
      </View>

      <SectionTitle title="Quick Actions" />

      <View style={styles.grid}>
        <Action
          icon="👤"
          title="Add Customer"
          onPress={() => setModal("party")}
        />

        <Action
          icon="💰"
          title="Payment"
          onPress={() => setModal("transaction")}
        />

        <Action
          icon="📦"
          title="Add Product"
          onPress={() => setModal("product")}
        />

        <Action
          icon="🧠"
          title="AI Advisor"
          onPress={() => go("smart")}
        />
      </View>

      <SectionTitle title="Smart Alerts" />

      {pendingCustomers.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>
            🔴 Payment Collection
          </Text>

          <Text style={styles.cardText}>
            {pendingCustomers.length} customer(s) owe you{" "}
            {money(
              pendingCustomers.reduce(
                (s, x) => s + x.balance,
                0
              )
            )}
          </Text>

          <Pressable
            style={styles.smallButton}
            onPress={() => go("khata")}
          >
            <Text style={styles.smallButtonText}>
              View Dues
            </Text>
          </Pressable>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>
            📦 Low Stock Alert
          </Text>

          <Text style={styles.cardText}>
            {lowStock.length} product(s) need restocking.
          </Text>

          <Pressable
            style={styles.smallButton}
            onPress={() => go("products")}
          >
            <Text style={styles.smallButtonText}>
              Check Stock
            </Text>
          </Pressable>
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>
          🧠 Today's Business Advice
        </Text>

        <Text style={styles.cardText}>
          {totals.profit > 0
            ? `Your current recorded profit is ${money(
                totals.profit
              )}. Focus on collecting pending customer payments.`
            : "Record today's sales, purchases and expenses to get a more accurate business health score."}
        </Text>
      </Card>

      <SectionTitle title="Business Modules" />

      <MenuButton
        title="📒 Khata & Customers"
        subtitle="Customers, suppliers, dues and payment history"
        onPress={() => go("khata")}
      />

      <MenuButton
        title="📦 Products & Stock"
        subtitle="Stock, low-stock alerts and product value"
        onPress={() => go("products")}
      />

      <MenuButton
        title="🧾 Transactions"
        subtitle="Sales, purchases, received and given"
        onPress={() => go("transactions")}
      />

      <MenuButton
        title="📊 Advanced Reports"
        subtitle="Profit, cash flow and business numbers"
        onPress={() => go("reports")}
      />

      <MenuButton
        title="🧠 Smart Business Advisor"
        subtitle="Automatic business recommendations"
        onPress={() => go("smart")}
      />
    </ScrollView>
  );
}

/* =========================================================
   SMART ADVISOR
========================================================= */

function SmartAdvisor({ data, totals, go }) {
  const score = healthScore(data, totals);

  const dues = data.customers
    .map((c) => ({
      ...c,
      balance: getPartyBalance(data, c.id),
    }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const lowStock = data.products.filter(
    (p) =>
      Number(p.stock || 0) <= Number(p.minStock || 0)
  );

  const advice = [];

  if (dues.length) {
    advice.push({
      icon: "💰",
      title: "Collect pending payments",
      text: `${dues[0].name} has the highest outstanding amount: ${money(
        dues[0].balance
      )}.`,
    });
  }

  if (lowStock.length) {
    advice.push({
      icon: "📦",
      title: "Restock products",
      text: `${lowStock
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")} need stock attention.`,
    });
  }

  if (totals.expenses > totals.sales * 0.3) {
    advice.push({
      icon: "⚠️",
      title: "Watch expenses",
      text: "Your recorded expenses are relatively high compared with sales.",
    });
  }

  if (totals.profit > 0) {
    advice.push({
      icon: "🚀",
      title: "Positive profit",
      text: `Recorded profit is ${money(
        totals.profit
      )}. Keep monitoring margins.`,
    });
  } else {
    advice.push({
      icon: "📈",
      title: "Improve profitability",
      text: "Record complete sales, purchase and expense data to identify where margin is being lost.",
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>
        🧠 Smart Business Advisor
      </Text>

      <View style={styles.hero}>
        <View>
          <Text style={styles.heroSmall}>
            BUSINESS SCORE
          </Text>
          <Text style={styles.score}>
            {score}/100
          </Text>
        </View>

        <Text style={styles.heroEmoji}>🧠</Text>
      </View>

      {advice.map((a, i) => (
        <Card key={i}>
          <Text style={styles.cardTitle}>
            {a.icon} {a.title}
          </Text>
          <Text style={styles.cardText}>
            {a.text}
          </Text>
        </Card>
      ))}

      <Card>
        <Text style={styles.cardTitle}>
          📌 Important
        </Text>

        <Text style={styles.cardText}>
          This version uses your recorded business data
          to generate automatic recommendations. It does
          not pretend to be a real external AI service.
        </Text>
      </Card>

      <MenuButton
        title="← Back to Dashboard"
        subtitle="Return to your business overview"
        onPress={() => go("home")}
      />
    </ScrollView>
  );
}

/* =========================================================
   KHATA
========================================================= */

function Khata({ data, saveData, setModal }) {
  const [search, setSearch] = useState("");

  const customers = data.customers
    .map((c) => ({
      ...c,
      balance: getPartyBalance(data, c.id),
    }))
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

  const suppliers = data.suppliers
    .map((s) => ({
      ...s,
      balance: getPartyBalance(data, s.id),
    }))
    .filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>
        📒 Khata
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Search customer / supplier"
        value={search}
        onChangeText={setSearch}
      />

      <Pressable
        style={styles.primary}
        onPress={() => setModal("party")}
      >
        <Text style={styles.primaryText}>
          + Add Customer / Supplier
        </Text>
      </Pressable>

      <SectionTitle title="Customers" />

      {customers.length === 0 && (
        <Empty text="No customers yet" />
      )}

      {customers.map((c) => (
        <PartyCard
          key={c.id}
          party={c}
          customer
        />
      ))}

      <SectionTitle title="Suppliers" />

      {suppliers.length === 0 && (
        <Empty text="No suppliers yet" />
      )}

      {suppliers.map((s) => (
        <PartyCard
          key={s.id}
          party={s}
        />
      ))}
    </ScrollView>
  );
}

function PartyCard({ party, customer }) {
  function whatsapp() {
    if (!party.phone) {
      Alert.alert("Phone number missing");
      return;
    }

    const amount = money(Math.abs(party.balance));

    const message = customer
      ? `Namaste ${party.name}, aapke account me ${amount} payment pending hai. Kripya payment kar dein.`
      : `Namaste ${party.name}, aapka ${amount} payable amount record me pending hai.`;

    const url =
      "whatsapp://send?phone=" +
      party.phone +
      "&text=" +
      encodeURIComponent(message);

    Linking.openURL(url).catch(() =>
      Alert.alert("WhatsApp available nahi hai.")
    );
  }

  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {party.name}
          </Text>

          <Text style={styles.cardText}>
            {party.phone || "No phone"}
          </Text>

          <Text
            style={[
              styles.balance,
              party.balance > 0
                ? styles.due
                : styles.clear,
            ]}
          >
            {party.balance > 0
              ? `You will receive ${money(party.balance)}`
              : party.balance < 0
              ? `You will give ${money(
                  Math.abs(party.balance)
                )}`
              : "Settled"}
          </Text>
        </View>

        {party.balance > 0 && (
          <Pressable
            style={styles.whatsapp}
            onPress={whatsapp}
          >
            <Text style={styles.whatsappText}>
              WhatsApp
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/* =========================================================
   PRODUCTS
========================================================= */

function Products({ data, saveData, setModal }) {
  const stockValue = getStockValue(data);

  const lowStock = data.products.filter(
    (p) =>
      Number(p.stock || 0) <= Number(p.minStock || 0)
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>
        📦 Products & Stock
      </Text>

      <View style={styles.grid}>
        <Stat
          title="Products"
          value={String(data.products.length)}
        />

        <Stat
          title="Stock Value"
          value={money(stockValue)}
        />
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => setModal("product")}
      >
        <Text style={styles.primaryText}>
          + Add Product
        </Text>
      </Pressable>

      {lowStock.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>
            🔴 Low Stock
          </Text>

          {lowStock.map((p) => (
            <Text
              key={p.id}
              style={styles.cardText}
            >
              {p.name}: {p.stock} {p.unit || "pcs"}
            </Text>
          ))}
        </Card>
      )}

      <SectionTitle title="All Products" />

      {data.products.map((p) => (
        <Card key={p.id}>
          <Text style={styles.cardTitle}>
            {p.name}
          </Text>

          <Text style={styles.cardText}>
            Sale: {money(p.price)} • Cost: {money(p.cost)}
          </Text>

          <Text style={styles.cardText}>
            Stock: {p.stock} {p.unit || "pcs"}
          </Text>

          <Text style={styles.cardText}>
            Margin:{" "}
            {Number(p.price) > 0
              ? Math.round(
                  ((Number(p.price) -
                    Number(p.cost)) /
                    Number(p.price)) *
                    100
                )
              : 0}
            %
          </Text>
        </Card>
      ))}

      {data.products.length === 0 && (
        <Empty text="No products added yet" />
      )}
    </ScrollView>
  );
}

/* =========================================================
   TRANSACTIONS
========================================================= */

function Transactions({ data, totals, saveData }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>
        🧾 Transactions
      </Text>

      <View style={styles.grid}>
        <Stat
          title="Sales"
          value={money(totals.sales)}
        />
        <Stat
          title="Purchases"
          value={money(totals.purchases)}
        />
        <Stat
          title="Received"
          value={money(totals.received)}
        />
        <Stat
          title="Given"
          value={money(totals.given)}
        />
      </View>

      {data.transactions
        .slice()
        .reverse()
        .map((t) => (
          <Card key={t.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {transactionName(t.type)}
                </Text>

                <Text style={styles.cardText}>
                  {t.note || "Transaction"}
                </Text>

                <Text style={styles.cardText}>
                  {t.date || today()}
                </Text>
              </View>

              <Text style={styles.amount}>
                {money(t.amount)}
              </Text>
            </View>
          </Card>
        ))}

      {data.transactions.length === 0 && (
        <Empty text="No transactions yet" />
      )}
    </ScrollView>
  );
}

function transactionName(type) {
  const names = {
    sale: "Sale",
    purchase: "Purchase",
    received: "Payment Received",
    given: "Payment Given",
  };

  return names[type] || type;
}

/* =========================================================
   REPORTS
========================================================= */

function Reports({ data, totals }) {
  const stockValue = getStockValue(data);

  const receivable = data.customers.reduce(
    (s, c) =>
      s + Math.max(0, getPartyBalance(data, c.id)),
    0
  );

  const payable = data.suppliers.reduce(
    (s, c) =>
      s + Math.max(0, -getPartyBalance(data, c.id)),
    0
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>
        📊 Advanced Reports
      </Text>

      <SectionTitle title="Financial Overview" />

      <Report
        title="Total Sales"
        value={money(totals.sales)}
      />

      <Report
        title="Total Purchase"
        value={money(totals.purchases)}
      />

      <Report
        title="Total Expenses"
        value={money(totals.expenses)}
      />

      <Report
        title="Estimated Profit"
        value={money(totals.profit)}
      />

      <SectionTitle title="Cash Flow" />

      <Report
        title="Money Received"
        value={money(totals.received)}
      />

      <Report
        title="Money Given"
        value={money(totals.given)}
      />

      <Report
        title="Net Cash Movement"
        value={money(totals.cash)}
      />

      <SectionTitle title="Business Position" />

      <Report
        title="Customer Receivable"
        value={money(receivable)}
      />

      <Report
        title="Supplier Payable"
        value={money(payable)}
      />

      <Report
        title="Stock Value"
        value={money(stockValue)}
      />

      <Card>
        <Text style={styles.cardTitle}>
          📈 Profit Insight
        </Text>

        <Text style={styles.cardText}>
          {totals.sales > 0
            ? `Estimated profit margin: ${Math.round(
                (totals.profit / totals.sales) * 100
              )}%`
            : "Add sales to calculate margin."}
        </Text>
      </Card>
    </ScrollView>
  );
}

function Report({ title, value }) {
  return (
    <View style={styles.report}>
      <Text style={styles.reportTitle}>
        {title}
      </Text>
      <Text style={styles.reportValue}>
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   MODALS
========================================================= */

function BusinessModal({ data, saveData, close }) {
  const [business, setBusiness] = useState({
    ...data.business,
  });

  async function save() {
    await saveData({
      ...data,
      business,
    });

    close();
  }

  return (
    <Modal animationType="slide">
      <SafeAreaView style={styles.modal}>
        <Text style={styles.pageTitle}>
          Business Profile
        </Text>

        <Input
          label="Business Name"
          value={business.name}
          onChangeText={(v) =>
            setBusiness({ ...business, name: v })
          }
        />

        <Input
          label="Owner"
          value={business.owner}
          onChangeText={(v) =>
            setBusiness({ ...business, owner: v })
          }
        />

        <Input
          label="Phone"
          value={business.phone}
          keyboardType="phone-pad"
          onChangeText={(v) =>
            setBusiness({ ...business, phone: v })
          }
        />

        <Input
          label="UPI ID"
          value={business.upi}
          onChangeText={(v) =>
            setBusiness({ ...business, upi: v })
          }
        />

        <Input
          label="GSTIN"
          value={business.gstin}
          onChangeText={(v) =>
            setBusiness({ ...business, gstin: v })
          }
        />

        <Pressable style={styles.primary} onPress={save}>
          <Text style={styles.primaryText}>
            Save Business
          </Text>
        </Pressable>

        <Pressable style={styles.cancel} onPress={close}>
          <Text>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function PartyModal({ data, saveData, close }) {
  const [type, setType] = useState("customer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function chooseContact() {
    try {
      const permission =
        await Contacts.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission required",
          "Contacts permission allow karein."
        );
        return;
      }

      const result =
        await Contacts.presentContactPickerAsync();

      const contact =
        result?.contact || result;

      if (contact) {
        const fullName =
          contact.name ||
          `${contact.firstName || ""} ${
            contact.lastName || ""
          }`.trim();

        const number =
          contact.phoneNumbers?.[0]?.number || "";

        setName(fullName);
        setPhone(number);
      }
    } catch (e) {
      Alert.alert(
        "Contact error",
        "Contact select nahi ho paya."
      );
    }
  }

  async function save() {
    if (!name.trim()) {
      Alert.alert("Name required");
      return;
    }

    const party = {
      id: id(),
      name: name.trim(),
      phone: phone.trim(),
      createdAt: today(),
    };

    const next = {
      ...data,
      customers:
        type === "customer"
          ? [...data.customers, party]
          : data.customers,
      suppliers:
        type === "supplier"
          ? [...data.suppliers, party]
          : data.suppliers,
    };

    await saveData(next);
    close();
  }

  return (
    <Modal animationType="slide">
      <SafeAreaView style={styles.modal}>
        <ScrollView>
          <Text style={styles.pageTitle}>
            Add Party
          </Text>

          <View style={styles.segment}>
            <Pressable
              style={[
                styles.segmentButton,
                type === "customer" &&
                  styles.segmentActive,
              ]}
              onPress={() => setType("customer")}
            >
              <Text>Customer</Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentButton,
                type === "supplier" &&
                  styles.segmentActive,
              ]}
              onPress={() => setType("supplier")}
            >
              <Text>Supplier</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.secondary}
            onPress={chooseContact}
          >
            <Text>
              📱 Choose from Phone Contacts
            </Text>
          </Pressable>

          <Input
            label="Name"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Phone"
            value={phone}
            keyboardType="phone-pad"
            onChangeText={setPhone}
          />

          <Pressable style={styles.primary} onPress={save}>
            <Text style={styles.primaryText}>
              Save Party
            </Text>
          </Pressable>

          <Pressable style={styles.cancel} onPress={close}>
            <Text>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ProductModal({ data, saveData, close }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [unit, setUnit] = useState("pcs");

  async function save() {
    if (!name.trim()) {
      Alert.alert("Product name required");
      return;
    }

    const product = {
      id: id(),
      name: name.trim(),
      price: Number(price || 0),
      cost: Number(cost || 0),
      stock: Number(stock || 0),
      minStock: Number(minStock || 0),
      unit,
      createdAt: today(),
    };

    await saveData({
      ...data,
      products: [...data.products, product],
    });

    close();
  }

  return (
    <Modal animationType="slide">
      <SafeAreaView style={styles.modal}>
        <ScrollView>
          <Text style={styles.pageTitle}>
            Add Product
          </Text>

          <Input
            label="Product Name"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Selling Price"
            value={price}
            keyboardType="decimal-pad"
            onChangeText={setPrice}
          />

          <Input
            label="Purchase / Cost Price"
            value={cost}
            keyboardType="decimal-pad"
            onChangeText={setCost}
          />

          <Input
            label="Current Stock"
            value={stock}
            keyboardType="decimal-pad"
            onChangeText={setStock}
          />

          <Input
            label="Minimum Stock Alert"
            value={minStock}
            keyboardType="decimal-pad"
            onChangeText={setMinStock}
          />

          <Input
            label="Unit"
            value={unit}
            onChangeText={setUnit}
          />

          <Pressable style={styles.primary} onPress={save}>
            <Text style={styles.primaryText}>
              Save Product
            </Text>
          </Pressable>

          <Pressable style={styles.cancel} onPress={close}>
            <Text>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TransactionModal({ data, saveData, close }) {
  const [type, setType] = useState("sale");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function save() {
    const value = Number(amount || 0);

    if (value <= 0) {
      Alert.alert("Amount enter karein");
      return;
    }

    const transaction = {
      id: id(),
      type,
      amount: value,
      note,
      date: today(),
    };

    await saveData({
      ...data,
      transactions: [
        ...data.transactions,
        transaction,
      ],
    });

    close();
  }

  return (
    <Modal animationType="slide">
      <SafeAreaView style={styles.modal}>
        <ScrollView>
          <Text style={styles.pageTitle}>
            Add Transaction
          </Text>

          <View style={styles.wrap}>
            {[
              ["sale", "Sale"],
              ["purchase", "Purchase"],
              ["received", "Received"],
              ["given", "Given"],
            ].map(([v, label]) => (
              <Pressable
                key={v}
                style={[
                  styles.typeButton,
                  type === v &&
                    styles.typeActive,
                ]}
                onPress={() => setType(v)}
              >
                <Text>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Input
            label="Amount"
            value={amount}
            keyboardType="decimal-pad"
            onChangeText={setAmount}
          />

          <Input
            label="Note"
            value={note}
            onChangeText={setNote}
          />

          <Pressable style={styles.primary} onPress={save}>
            <Text style={styles.primaryText}>
              Save Transaction
            </Text>
          </Pressable>

          <Pressable style={styles.cancel} onPress={close}>
            <Text>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function Bottom({ current, setScreen }) {
  const items = [
    ["home", "🏠", "Home"],
    ["khata", "📒", "Khata"],
    ["products", "📦", "Stock"],
    ["reports", "📊", "Reports"],
    ["smart", "🧠", "Smart"],
  ];

  return (
    <>
      {items.map(([screen, icon, title]) => (
        <Pressable
          key={screen}
          style={styles.navItem}
          onPress={() => setScreen(screen)}
        >
          <Text style={styles.navIcon}>
            {icon}
          </Text>

          <Text
            style={[
              styles.navText,
              current === screen &&
                styles.navSelected,
            ]}
          >
            {title}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

function Stat({ title, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statTitle}>
        {title}
      </Text>

      <Text style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function Action({ icon, title, onPress }) {
  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>
        {icon}
      </Text>

      <Text style={styles.actionText}>
        {title}
      </Text>
    </Pressable>
  );
}

function MenuButton({ title, subtitle, onPress }) {
  return (
    <Pressable
      style={styles.menu}
      onPress={onPress}
    >
      <Text style={styles.menuTitle}>
        {title}
      </Text>

      <Text style={styles.menuSub}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ title }) {
  return (
    <Text style={styles.sectionTitle}>
      {title}
    </Text>
  );
}

function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Text>{text}</Text>
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  keyboardType,
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.inputLabel}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={label}
      />
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    padding: 24,
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#666",
    marginBottom: 20,
  },

  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  headerSub: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 3,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 16,
    paddingBottom: 100,
  },

  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 16,
  },

  hero: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroSmall: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  score: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 4,
  },

  heroText: {
    color: "#E5E7EB",
    marginTop: 2,
  },

  heroEmoji: {
    fontSize: 48,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },

  stat: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "48%",
    minHeight: 85,
    justifyContent: "center",
  },

  statTitle: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 5,
  },

  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 10,
  },

  action: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    minHeight: 95,
    justifyContent: "center",
  },

  actionIcon: {
    fontSize: 26,
    marginBottom: 8,
  },

  actionText: {
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 17,
    marginBottom: 11,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },

  cardText: {
    color: "#6B7280",
    lineHeight: 21,
  },

  smallButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 12,
  },

  smallButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  primary: {
    backgroundColor: "#111827",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: "center",
    marginBottom: 12,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  secondary: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
  },

  cancel: {
    alignItems: "center",
    padding: 15,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },

  pinInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 14,
    width: "80%",
    textAlign: "center",
    fontSize: 22,
    marginVertical: 15,
  },

  balance: {
    marginTop: 8,
    fontWeight: "800",
  },

  due: {
    color: "#DC2626",
  },

  clear: {
    color: "#16A34A",
  },

  whatsapp: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },

  whatsappText: {
    fontWeight: "700",
  },

  amount: {
    fontSize: 18,
    fontWeight: "900",
  },

  report: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reportTitle: {
    color: "#6B7280",
  },

  reportValue: {
    fontSize: 17,
    fontWeight: "800",
  },

  menu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 17,
    marginBottom: 10,
  },

  menuTitle: {
    fontSize: 16,
    fontWeight: "800",
  },

  menuSub: {
    color: "#6B7280",
    marginTop: 5,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },

  navIcon: {
    fontSize: 21,
  },

  navText: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 3,
  },

  navSelected: {
    color: "#111827",
    fontWeight: "800",
  },

  modal: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    padding: 18,
  },

  segment: {
    flexDirection: "row",
    marginBottom: 15,
    gap: 8,
  },

  segmentButton: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  segmentActive: {
    backgroundColor: "#E5E7EB",
  },

  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },

  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  typeActive: {
    backgroundColor: "#D1FAE5",
  },

  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    padding: 25,
    alignItems: "center",
    marginBottom: 10,
  },
});

export default App;
