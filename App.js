
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
          customers: x.customers || [],
          suppliers: x.suppliers || [],
          transactions: x.transactions || [],
          expenses: x.expenses || [],
        });
      }

      if (p) {
        setSavedPin(p);
        setLocked(true);
      }
    } catch (e) {
      console.log(e);
    }

    setReady(true);
  }

  useEffect(() => {
    if (ready) {
      AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  function balance(party) {
    let b = num(party.openingBalance);

    if (party.balanceType === "advance") b = -b;

    data.transactions.forEach((t) => {
      if (
        t.partyId === party.id &&
        t.partyType === party.type
      ) {
        if (
          party.type === "customer" &&
          t.type === "sale"
        )
          b += t.amount;

        if (
          party.type === "customer" &&
          t.type === "received"
        )
          b -= t.amount;

        if (
          party.type === "customer" &&
          t.type === "given"
        )
          b += t.amount;

        if (
          party.type === "supplier" &&
          t.type === "purchase"
        )
          b += t.amount;

        if (
          party.type === "supplier" &&
          t.type === "given"
        )
          b -= t.amount;

        if (
          party.type === "supplier" &&
          t.type === "received"
        )
          b += t.amount;
      }
    });

    return b;
  }

  const customers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return data.customers;

    return data.customers.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.customers, search]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return data.suppliers;

    return data.suppliers.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        String(x.phone || "").includes(q)
    );
  }, [data.suppliers, search]);

  const receivable = data.customers.reduce(
    (s, p) => s + Math.max(balance({ ...p, type: "customer" }), 0),
    0
  );

  const payable = data.suppliers.reduce(
    (s, p) => s + Math.max(balance({ ...p, type: "supplier" }), 0),
    0
  );

  const received = data.transactions
    .filter((x) => x.type === "received")
    .reduce((s, x) => s + x.amount, 0);

  const given = data.transactions
    .filter((x) => x.type === "given")
    .reduce((s, x) => s + x.amount, 0);

  const sales = data.transactions
    .filter((x) => x.type === "sale")
    .reduce((s, x) => s + x.amount, 0);

  const purchases = data.transactions
    .filter((x) => x.type === "purchase")
    .reduce((s, x) => s + x.amount, 0);

  const expenses = data.expenses.reduce(
    (s, x) => s + x.amount,
    0
  );

  function openParty(type, party = null) {
    setForm(
      party
        ? { ...party }
        : {
            name: "",
            phone: "",
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

  function saveParty() {
    if (!String(form.name || "").trim()) {
      Alert.alert("Required", "Name enter karein.");
      return;
    }

    const type =
      modal === "supplier" ||
      (modal === "editParty" &&
        form.type === "supplier")
        ? "supplier"
        : "customer";

    const party = {
      id: form.id || uid(type),
      name: String(form.name).trim(),
      phone: form.phone || "",
      address: form.address || "",
      gst: form.gst || "",
      openingBalance: num(form.openingBalance),
      balanceType: form.balanceType || "due",
    };

    setData((old) => {
      if (form.id) {
        return {
          ...old,
          [type === "customer"
            ? "customers"
            : "suppliers"]:
            old[
              type === "customer"
                ? "customers"
                : "suppliers"
            ].map((x) =>
              x.id === form.id ? party : x
            ),
        };
      }

      return {
        ...old,
        [type === "customer"
          ? "customers"
          : "suppliers"]: [
          ...old[
            type === "customer"
              ? "customers"
              : "suppliers"
          ],
          party,
        ],
      };
    });

    setModal("");
    setForm({});
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
      paymentMode: form.paymentMode,
      reference: form.reference || "",
      note: form.note || "",
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

    if (!amount) {
      Alert.alert("Amount", "Amount enter karein.");
      return;
    }

    const tx = {
      id: uid("tx"),
      partyId: selected.id,
      partyType: selected.type,
      partyName: selected.name,
      type: modal,
      amount,
      paymentMode: form.paymentMode,
      reference: form.reference || "",
      note: form.note || "",
      date: form.date || today(),
      createdAt: Date.now(),
    };

    setData((old) => ({
      ...old,
      transactions: [tx, ...old.transactions],
    }));

   
