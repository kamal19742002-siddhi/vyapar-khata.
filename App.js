import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

const INITIAL_CUSTOMERS = [
  {
    id: "customer-1",
    name: "Bhayani plywood & hardware",
    phone: "9986179882",
    balance: 35000,
    payments: [],
  },
];

const INITIAL_SUPPLIERS = [];

export default function App() {
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);

  const [activeTab, setActiveTab] = useState("customers");
  const [screen, setScreen] = useState("home");

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [paymentType, setPaymentType] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // --------------------------------------------------
  // OPEN CUSTOMER PROFILE
  // --------------------------------------------------

  const openCustomerProfile = (customer) => {
    setSelectedCustomer(customer);
    setScreen("profile");
  };

  // --------------------------------------------------
  // OPEN PAYMENT SCREEN
  // --------------------------------------------------

  const openPaymentScreen = (type) => {
    setPaymentType(type);
    setAmount("");
    setNote("");
    setScreen("payment");
  };

  // --------------------------------------------------
  // SAVE PAYMENT
  // --------------------------------------------------

  const savePayment = () => {
    const cleanAmount = amount.replace(/,/g, "").trim();
    const numericAmount = Number(cleanAmount);

    if (!cleanAmount || !Number.isFinite(numericAmount)) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    if (numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Amount must be greater than ₹0.");
      return;
    }

    const now = new Date();

    const date =
      String(now.getDate()).padStart(2, "0") +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      now.getFullYear();

    const time =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");

    const payment = {
      id: "payment-" + Date.now(),
      type: paymentType,
      amount: numericAmount,
      note: note.trim(),
      date: date,
      time: time,
    };

    const updatedCustomers = customers.map((customer) => {
      if (customer.id !== selectedCustomer.id) {
        return customer;
      }

      let newBalance = customer.balance;

      /*
       * Payment Received:
       * Customer gave us money.
       * Customer's outstanding balance decreases.
       *
       * Payment Given:
       * We gave customer money.
       * Customer's outstanding balance increases.
       */

      if (paymentType === "received") {
        newBalance = customer.balance - numericAmount;
      } else {
        newBalance = customer.balance + numericAmount;
      }

      return {
        ...customer,
        balance: newBalance,
        payments: [payment, ...(customer.payments || [])],
      };
    });

    setCustomers(updatedCustomers);

    const updatedCustomer = updatedCustomers.find(
      (customer) => customer.id === selectedCustomer.id
    );

    setSelectedCustomer(updatedCustomer);

    setAmount("");
    setNote("");
    setPaymentType(null);

    setScreen("profile");

    Alert.alert(
      "Payment Saved",
      paymentType === "received"
        ? "Payment received successfully."
        : "Payment given successfully."
    );
  };

  // --------------------------------------------------
  // ADD CUSTOMER
  // --------------------------------------------------

  const addCustomer = () => {
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();

    if (!name) {
      Alert.alert("Customer Name", "Please enter customer name.");
      return;
    }

    const newCustomer = {
      id: "customer-" + Date.now(),
      name: name,
      phone: phone || "No phone number",
      balance: 0,
      payments: [],
    };

    setCustomers((previous) => [...previous, newCustomer]);

    setNewCustomerName("");
    setNewCustomerPhone("");

    setScreen("home");

    Alert.alert("Customer Added", "Customer added successfully.");
  };

  // --------------------------------------------------
  // TOTAL CUSTOMER BALANCE
  // --------------------------------------------------

  const customerTotal = customers.reduce(
    (total, customer) => total + customer.balance,
    0
  );

  // --------------------------------------------------
  // TOTAL SUPPLIER BALANCE
  // --------------------------------------------------

  const supplierTotal = suppliers.reduce(
    (total, supplier) => total + supplier.balance,
    0
  );

  // --------------------------------------------------
  // FORMAT RUPEES
  // --------------------------------------------------

  const formatRupees = (value) => {
    const number = Number(value) || 0;

    return "₹" + number.toLocaleString("en-IN");
  };

  // ==================================================
  // PAYMENT SCREEN
  // ==================================================

  if (screen === "payment") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setPaymentType(null);
                setScreen("profile");
              }}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.topHeaderTitle}>
              {paymentType === "received"
                ? "Payment Received"
                : "Payment Given"}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.paymentCard}>
              <Text style={styles.paymentCustomerName}>
                {selectedCustomer?.name}
              </Text>

              <Text style={styles.paymentCustomerPhone}>
                {selectedCustomer?.phone}
              </Text>

              <View
                style={[
                  styles.paymentTypeBanner,
                  paymentType === "received"
                    ? styles.receivedBanner
                    : styles.givenBanner,
                ]}
              >
                <Text style={styles.paymentTypeBannerText}>
                  {paymentType === "received"
                    ? "MONEY RECEIVED FROM CUSTOMER"
                    : "MONEY GIVEN TO CUSTOMER"}
                </Text>
              </View>

              <Text style={styles.inputLabel}>Amount</Text>

              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="₹ 0"
                placeholderTextColor="#999999"
                autoFocus={false}
              />

              <Text style={styles.inputLabel}>Note</Text>

              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Example: Cash payment"
                placeholderTextColor="#999999"
                multiline={false}
              />

              <TouchableOpacity
                style={styles.savePaymentButton}
                onPress={savePayment}
              >
                <Text style={styles.savePaymentButtonText}>
                  SAVE PAYMENT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setPaymentType(null);
                  setScreen("profile");
                }}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==================================================
  // CUSTOMER PROFILE
  // ==================================================

  if (screen === "profile" && selectedCustomer) {
    const payments = selectedCustomer.payments || [];

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setScreen("home")}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.topHeaderTitle}>Customer Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileCard}>
            <Text style={styles.profileName}>
              {selectedCustomer.name}
            </Text>

            <Text style={styles.profilePhone}>
              {selectedCustomer.phone}
            </Text>

            <View style={styles.balanceBox}>
              <Text style={styles.balanceCaption}>
                Current Balance
              </Text>

              <Text
                style={[
                  styles.profileBalance,
                  selectedCustomer.balance >= 0
                    ? styles.balancePositive
                    : styles.balanceNegative,
                ]}
              >
                {formatRupees(selectedCustomer.balance)}
              </Text>

              <Text style={styles.balanceExplanation}>
                {selectedCustomer.balance > 0
                  ? "Amount due from customer"
                  : selectedCustomer.balance < 0
                  ? "Extra amount received"
                  : "Account settled"}
              </Text>
            </View>
          </View>

          {/* QUICK PAYMENT */}

          <Text style={styles.sectionTitle}>Quick Payment</Text>

          <TouchableOpacity
            style={styles.receivedButton}
            onPress={() => openPaymentScreen("received")}
          >
            <Text style={styles.quickButtonText}>
              + PAYMENT RECEIVED
            </Text>

            <Text style={styles.quickButtonSubText}>
              Customer paid money
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.givenButton}
            onPress={() => openPaymentScreen("given")}
          >
            <Text style={styles.quickButtonText}>
              − PAYMENT GIVEN
            </Text>

            <Text style={styles.quickButtonSubText}>
              Money given to customer
            </Text>
          </TouchableOpacity>

          {/* RECENT PAYMENTS */}

          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>
              Recent Payments
            </Text>

            <Text style={styles.paymentCount}>
              {payments.length}
            </Text>
          </View>

          {payments.length === 0 ? (
            <View style={styles.emptyPaymentCard}>
              <Text style={styles.emptyPaymentIcon}>₹</Text>

              <Text style={styles.emptyPaymentTitle}>
                No Recent Payments
              </Text>

              <Text style={styles.emptyPaymentText}>
                Payment history will appear here after you
                record a payment.
              </Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View
                key={payment.id}
                style={styles.paymentHistoryCard}
              >
                <View style={styles.paymentHistoryLeft}>
                  <View
                    style={[
                      styles.paymentCircle,
                      payment.type === "received"
                        ? styles.receivedCircle
                        : styles.givenCircle,
                    ]}
                  >
                    <Text style={styles.paymentCircleText}>
                      {payment.type === "received" ? "+" : "−"}
                    </Text>
                  </View>

                  <View style={styles.paymentHistoryInfo}>
                    <Text style={styles.paymentHistoryTitle}>
                      {payment.type === "received"
                        ? "Payment Received"
                        : "Payment Given"}
                    </Text>

                    <Text style={styles.paymentHistoryDate}>
                      {payment.date} • {payment.time}
                    </Text>

                    {payment.note ? (
                      <Text style={styles.paymentHistoryNote}>
                        {payment.note}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text
                  style={[
                    styles.paymentHistoryAmount,
                    payment.type === "received"
                      ? styles.receivedAmount
                      : styles.givenAmount,
                  ]}
                >
                  {payment.type === "received" ? "+" : "-"}
                  {formatRupees(payment.amount)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==================================================
  // ADD CUSTOMER SCREEN
  // ==================================================

  if (screen === "addCustomer") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setScreen("home")}
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.topHeaderTitle}>
              Add Customer
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Customer Details</Text>

              <Text style={styles.inputLabel}>Customer Name</Text>

              <TextInput
                style={styles.formInput}
                value={newCustomerName}
                onChangeText={setNewCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor="#999999"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>

              <TextInput
                style={styles.formInput}
                value={newCustomerPhone}
                onChangeText={setNewCustomerPhone}
                placeholder="Enter phone number"
                placeholderTextColor="#999999"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.saveCustomerButton}
                onPress={addCustomer}
              >
                <Text style={styles.saveCustomerButtonText}>
                  ADD CUSTOMER
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==================================================
  // HOME
  // ==================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainHeader}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.appTitle}>Vyapar Khata</Text>

          <Text style={styles.appSubtitle}>
            Digital Business Ledger
          </Text>
        </View>

        <TouchableOpacity
          style={styles.lockButton}
          onPress={() =>
            Alert.alert(
              "Security",
              "Security PIN feature is available."
            )
          }
        >
          <Text style={styles.lockButtonText}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>

      {/* SUMMARY */}

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Customers</Text>

          <Text style={styles.summaryAmount}>
            {formatRupees(customerTotal)}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Suppliers</Text>

          <Text style={styles.summaryAmount}>
            {formatRupees(supplierTotal)}
          </Text>
        </View>
      </View>

      {/* TABS */}

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "customers" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("customers")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "customers" &&
                styles.activeTabText,
            ]}
          >
            CUSTOMERS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "suppliers" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("suppliers")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "suppliers" &&
                styles.activeTabText,
            ]}
          >
            SUPPLIERS
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.homeScroll}>
        {/* CUSTOMERS */}

        {activeTab === "customers" ? (
          <>
            <TouchableOpacity
              style={styles.addCustomerButton}
              onPress={() => setScreen("addCustomer")}
            >
              <Text style={styles.addCustomerText}>
                + ADD CUSTOMER
              </Text>
            </TouchableOpacity>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Customers</Text>

              <Text style={styles.contactText}>
                {customers.length} Contacts
              </Text>
            </View>

            {customers.length === 0 ? (
              <View style={styles.noCustomerCard}>
                <Text style={styles.noCustomerTitle}>
                  No Customers
                </Text>

                <Text style={styles.noCustomerText}>
                  Add your first customer.
                </Text>
              </View>
            ) : (
              customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={styles.customerCard}
                  onPress={() =>
                    openCustomerProfile(customer)
                  }
                >
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>
                      {customer.name}
                    </Text>

                    <Text style={styles.customerPhone}>
                      {customer.phone}
                    </Text>

                    <Text
                      style={[
                        styles.customerBalance,
                        customer.balance >= 0
                          ? styles.balancePositive
                          : styles.balanceNegative,
                      ]}
                    >
                      Balance: {formatRupees(customer.balance)}
                    </Text>
                  </View>

                  <Text style={styles.viewProfile}>
                    View Profile →
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.supplierEmptyCard}>
              <Text style={styles.supplierIcon}>🏪</Text>

              <Text style={styles.supplierTitle}>
                Suppliers
              </Text>

              <Text style={styles.supplierText}>
                Supplier management can be added here.
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.securityButton}
          onPress={() =>
            Alert.alert(
              "Security",
              "Change Security PIN feature."
            )
          }
        >
          <Text style={styles.securityText}>
            ⚙️ Change Security PIN
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  mainHeader: {
    backgroundColor: "#1261a8",
    paddingHorizontal: 25,
    paddingTop: 18,
    paddingBottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTextContainer: {
    flex: 1,
  },

  appTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
  },

  appSubtitle: {
    color: "#e5eef8",
    fontSize: 19,
    marginTop: 5,
  },

  lockButton: {
    backgroundColor: "#3b82bd",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 11,
  },

  lockButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },

  topHeader: {
    height: 70,
    backgroundColor: "#1261a8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  backButton: {
    width: 48,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },

  backIcon: {
    color: "#ffffff",
    fontSize: 44,
    lineHeight: 48,
  },

  topHeaderTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 4,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  homeScroll: {
    paddingBottom: 50,
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 25,
    marginVertical: 24,
    borderRadius: 20,
    paddingVertical: 27,
    flexDirection: "row",
    justifyContent: "space-around",
    elevation: 4,
  },

  summaryItem: {
    alignItems: "center",
    flex: 1,
  },

  summaryLabel: {
    color: "#666666",
    fontSize: 23,
  },

  summaryAmount: {
    color: "#18865f",
    fontSize: 35,
    fontWeight: "800",
    marginTop: 7,
  },

  tabsContainer: {
    height: 89,
    backgroundColor: "#1261a8",
    flexDirection: "row",
  },

  tabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 8,
    borderBottomColor: "transparent",
  },

  activeTab: {
    borderBottomColor: "#ffd129",
  },

  tabText: {
    color: "#dbeafa",
    fontSize: 23,
    fontWeight: "800",
  },

  activeTabText: {
    color: "#ffffff",
  },

  addCustomerButton: {
    marginHorizontal: 25,
    marginTop: 38,
    marginBottom: 38,
    backgroundColor: "#1261a8",
    borderRadius: 15,
    paddingVertical: 24,
    alignItems: "center",
  },

  addCustomerText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },

  listHeader: {
    paddingHorizontal: 25,
    marginBottom: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listTitle: {
    fontSize: 33,
    fontWeight: "800",
    color: "#222222",
  },

  contactText: {
    fontSize: 21,
    color: "#666666",
  },

  customerCard: {
    marginHorizontal: 25,
    marginBottom: 15,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 23,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
  },

  customerInfo: {
    flex: 1,
    paddingRight: 8,
  },

  customerName: {
    color: "#252525",
    fontSize: 26,
    fontWeight: "800",
  },

  customerPhone: {
    color: "#666666",
    fontSize: 19,
    marginTop: 6,
  },

  customerBalance: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
  },

  viewProfile: {
    color: "#1261a8",
    fontSize: 18,
    fontWeight: "800",
  },

  balancePositive: {
    color: "#18865f",
  },

  balanceNegative: {
    color: "#d14b4b",
  },

  securityButton: {
    alignItems: "center",
    paddingVertical: 35,
  },

  securityText: {
    color: "#1261a8",
    fontSize: 21,
    fontWeight: "700",
  },

  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 19,
    padding: 24,
    elevation: 3,
    marginBottom: 28,
  },

  profileName: {
    color: "#222222",
    fontSize: 29,
    fontWeight: "800",
  },

  profilePhone: {
    color: "#666666",
    fontSize: 19,
    marginTop: 7,
  },

  balanceBox: {
    marginTop: 22,
    backgroundColor: "#f3f7fa",
    borderRadius: 15,
    padding: 18,
  },

  balanceCaption: {
    color: "#666666",
    fontSize: 17,
  },

  profileBalance: {
    fontSize: 35,
    fontWeight: "800",
    marginTop: 5,
  },

  balanceExplanation: {
    color: "#777777",
    fontSize: 15,
    marginTop: 4,
  },

  sectionTitle: {
    color: "#222222",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 14,
  },

  receivedButton: {
    backgroundColor: "#18865f",
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },

  givenButton: {
    backgroundColor: "#d14b4b",
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 28,
  },

  quickButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },

  quickButtonSubText: {
    color: "#ffffff",
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },

  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  paymentCount: {
    backgroundColor: "#1261a8",
    color: "#ffffff",
    minWidth: 30,
    textAlign: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 15,
    fontSize: 15,
    fontWeight: "800",
  },

  emptyPaymentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 17,
    padding: 30,
    alignItems: "center",
    elevation: 2,
  },

  emptyPaymentIcon: {
    color: "#1261a8",
    fontSize: 40,
    fontWeight: "800",
  },

  emptyPaymentTitle: {
    color: "#333333",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 8,
  },

  emptyPaymentText: {
    color: "#777777",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 23,
  },

  paymentHistoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 17,
    marginBottom: 11,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  paymentHistoryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  paymentCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  receivedCircle: {
    backgroundColor: "#dff4eb",
  },

  givenCircle: {
    backgroundColor: "#f9dfdf",
  },

  paymentCircleText: {
    fontSize: 25,
    fontWeight: "800",
  },

  paymentHistoryInfo: {
    flex: 1,
  },

  paymentHistoryTitle: {
    color: "#222222",
    fontSize: 17,
    fontWeight: "800",
  },

  paymentHistoryDate: {
    color: "#777777",
    fontSize: 14,
    marginTop: 4,
  },

  paymentHistoryNote: {
    color: "#666666",
    fontSize: 14,
    marginTop: 3,
  },

  paymentHistoryAmount: {
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 8,
  },

  receivedAmount: {
    color: "#18865f",
  },

  givenAmount: {
    color: "#d14b4b",
  },

  paymentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    elevation: 3,
  },

  paymentCustomerName: {
    color: "#222222",
    fontSize: 26,
    fontWeight: "800",
  },

  paymentCustomerPhone: {
    color: "#666666",
    fontSize: 18,
    marginTop: 5,
  },

  paymentTypeBanner: {
    marginTop: 22,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },

  receivedBanner: {
    backgroundColor: "#18865f",
  },

  givenBanner: {
    backgroundColor: "#d14b4b",
  },

  paymentTypeBannerText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  inputLabel: {
    color: "#333333",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 23,
    marginBottom: 8,
  },

  amountInput: {
    borderWidth: 1,
    borderColor: "#cccccc",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 15,
    fontSize: 28,
    fontWeight: "700",
    color: "#222222",
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#cccccc",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 15,
    fontSize: 17,
    color: "#222222",
  },

  savePaymentButton: {
    backgroundColor: "#1261a8",
    borderRadius: 13,
    paddingVertical: 19,
    alignItems: "center",
    marginTop: 28,
  },

  savePaymentButtonText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },

  cancelButton: {
    alignItems: "center",
    paddingVertical: 17,
  },

  cancelButtonText: {
    color: "#1261a8",
    fontSize: 17,
    fontWeight: "700",
  },

  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    elevation: 3,
  },

  formTitle: {
    color: "#222222",
    fontSize: 27,
    fontWeight: "800",
    marginBottom: 5,
  },

  formInput: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 18,
    color: "#222222",
  },

  saveCustomerButton: {
    backgroundColor: "#1261a8",
    borderRadius: 13,
    paddingVertical: 19,
    alignItems: "center",
    marginTop: 30,
  },

  saveCustomerButtonText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },

  noCustomerCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 25,
    padding: 30,
    borderRadius: 18,
    alignItems: "center",
  },

  noCustomerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },

  noCustomerText: {
    color: "#777777",
    marginTop: 7,
  },

  supplierEmptyCard: {
    margin: 25,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 35,
    alignItems: "center",
    elevation: 2,
  },

  supplierIcon: {
    fontSize: 42,
  },

  supplierTitle: {
    fontSize: 25,
    fontWeight: "800",
    marginTop: 10,
  },

  supplierText: {
    color: "#777777",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
});
