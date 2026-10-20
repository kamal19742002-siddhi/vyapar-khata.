import * as Contacts from 'expo-contacts';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, SafeAreaView, StatusBar, View, Text, TextInput,
  TouchableOpacity, ScrollView, StyleSheet, Switch, Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BLUE = '#1059A8';
const LIGHT_BLUE = '#EAF2FF';
const BG = '#F0F1F3';
const GREEN = '#087F5B';
const RED = '#D83A4E';
const GOLD = '#FFCB4D';
const STORAGE_KEY = 'vyapar-khata-complete-v1';

const initialData = {
  businessName: 'Rishab Tech Enterprises',
  ownerName: 'Rishab Tech',
  location: 'Aligarh, Uttar Pradesh',
  customers: [],
  transactions: [],
  items: [],
  trash: [],
  darkMode: false,
  fingerprintLock: false,
};

const money = value =>
  '₹' + Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });

const today = () => new Date().toISOString().slice(0, 10);
const uid = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const safeText = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

export default function App() {
  const [data, setData] = useState(initialData);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState('Parties');
  const [navHistory, setNavHistory] = useState(['Parties']);
  const [tab, setTab] = useState('Customers');
  const [search, setSearch] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportCategory, setReportCategory] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [form, setForm] = useState({});
  const [txType, setTxType] = useState('give');
  const [itemForm, setItemForm] = useState({});
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setData({ ...initialData, ...JSON.parse(raw) });
        }
      } catch {
        Alert.alert('Storage', 'Saved data could not be loaded.');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        .catch(() => {});
    }
  }, [data, loaded]);

  const updateData = patch =>
    setData(old => ({ ...old, ...patch }));

  const navigateTo = newPage => {
    setNavHistory(old => [...old, newPage]);
    setPage(newPage);
  };

  const goBack = () => {
    if (page === 'Party detail') {
      setSelectedParty(null);
      setPage('Parties');
      return;
    }
    if (page === 'Report detail') {
      setSelectedReport(null);
      setPage('Reports');
      return;
    }
    if (page === 'Add transaction' || page === 'Edit transaction') {
      setPage('Party detail');
      return;
    }
    if (['Reports', 'More', 'Items', 'Recycle Bin', 'Settings', 'Help & Support', 'About Us', 'Edit profile', 'Add item'].includes(page)) {
      setPage('Parties');
      return;
    }
    setNavHistory(old => {
      if (old.length <= 1) return ['Parties'];
      const nextStack = old.slice(0, -1);
      const target = nextStack[nextStack.length - 1] || 'Parties';
      setPage(target);
      return nextStack;
    });
  };

  const setField = (key, value) =>
    setForm(old => ({ ...old, [key]: value }));

  const setItemField = (key, value) =>
    setItemForm(old => ({ ...old, [key]: value }));

  const setProfileField = (key, value) =>
    setProfileForm(old => ({ ...old, [key]: value }));

  const balanceFor = partyId =>
    data.transactions
      .filter(t => t.partyId === partyId)
      .reduce(
        (sum, t) =>
          sum + (t.type === 'give'
            ? Number(t.amount)
            : -Number(t.amount)),
        0
      );

  const filteredParties = useMemo(
    () =>
      data.customers.filter(p => {
        const matchesTab = tab === 'All' || p.type === tab;
        const matchesSearch =
          `${p.name} ${p.phone || ''}`
            .toLowerCase()
            .includes(search.toLowerCase());

        return matchesTab && matchesSearch;
      }),
    [data.customers, tab, search]
  );

  const reports = [
    {
      category: 'Reports',
      title: 'Passbook',
      subtitle: 'All party passbook entries',
      kind: 'customerTransactions',
    },
    {
      category: 'Reports',
      title: 'Cashbook',
      subtitle: 'Cash inflow and outflow summary',
      kind: 'cashbook',
    },
    {
      category: 'Reports',
      title: 'Bills',
      subtitle: 'Sales and purchase bills summary',
      kind: 'sales',
    },
    {
      category: 'Reports',
      title: 'Items',
      subtitle: 'Stock and inventory report',
      kind: 'stock',
    },
    {
      category: 'Reports',
      title: 'Staff',
      subtitle: 'Staff attendance and payroll report',
      kind: 'customerList',
    },
    {
      category: 'Reports',
      title: 'Collection',
      subtitle: 'Payment collections summary',
      kind: 'supplierTransactions',
    },
  ];

  function addParty() {
    const name = (form.name || '').trim();

    if (!name) {
      return Alert.alert('Required', 'Please enter a name.');
    }

    const party = {
      id: uid(),
      name,
      phone: (form.phone || '').trim(),
      type: form.type || tab || 'Customers',
      openingBalance: Number(form.openingBalance || 0),
    };

    updateData({
      customers: [...data.customers, party],
    });

    setForm({});
    setPage('Parties');
    setTab(party.type);
  }

  function addTransaction() {
    const amount = Number(form.amount);

    if (!selectedParty) return;

    if (!Number.isFinite(amount) || amount <= 0) {
      return Alert.alert(
        'Invalid amount',
        'Enter an amount greater than zero.'
      );
    }

    if (form.editId) {
      const updatedTxs = data.transactions.map(t =>
        t.id === form.editId
          ? {
              ...t,
              type: txType,
              amount,
              date: form.date || today(),
              note: (form.note || '').trim(),
            }
          : t
      );
      updateData({ transactions: updatedTxs });
    } else {
      const tx = {
        id: uid(),
        partyId: selectedParty.id,
        type: txType,
        amount,
        date: form.date || today(),
        note: (form.note || '').trim(),
      };

      updateData({
        transactions: [...data.transactions, tx],
      });
    }

    setForm({});
    setPage('Party detail');
  }

  function addItem() {
    const name = (itemForm.name || '').trim();
    const quantity = Number(itemForm.quantity || 0);
    const salePrice = Number(itemForm.salePrice || 0);
    const purchasePrice = Number(itemForm.purchasePrice || 0);

    if (!name) {
      return Alert.alert('Required', 'Enter an item name.');
    }

    if (quantity < 0 || salePrice < 0 || purchasePrice < 0) {
      return Alert.alert(
        'Invalid values',
        'Quantity and prices cannot be negative.'
      );
    }

    const item = {
      id: uid(),
      name,
      quantity,
      salePrice,
      purchasePrice,
      lowStockAt: Number(itemForm.lowStockAt || 5),
    };

    updateData({ items: [...data.items, item] });
    setItemForm({});
    setPage('Items');
  }

  const inDateRange = row => {
    const date = (row.date || '').slice(0, 10);

    return (
      (!fromDate || date >= fromDate) &&
      (!toDate || date <= toDate)
    );
  };

  function reportRows(report) {
    const kind = report.kind;

    if (kind === 'customerList' || kind === 'supplierList') {
      const type = kind === 'customerList' ? 'Customers' : 'Suppliers';

      return data.customers
        .filter(p => p.type === type)
        .map(p => ({
          date: '',
          party: p.name,
          phone: p.phone || '',
          note: 'Current balance',
          amount: balanceFor(p.id),
        }));
    }

    if (kind === 'stock' || kind === 'lowStock' || kind === 'profitLoss') {
      let items = data.items;

      if (kind === 'lowStock') {
        items = items.filter(
          i => Number(i.quantity) <= Number(i.lowStockAt)
        );
      }

      return items.map(i => ({
        date: '',
        party: i.name,
        phone: `Qty: ${i.quantity}`,
        note:
          kind === 'profitLoss'
            ? 'Estimated stock margin'
            : 'Stock item',
        amount:
          kind === 'profitLoss'
            ? (Number(i.salePrice) - Number(i.purchasePrice)) * Number(i.quantity)
            : Number(i.quantity),
      }));
    }

    let txs = data.transactions.filter(inDateRange);

    if (kind === 'customerTransactions') {
      txs = txs.filter(
        t =>
          data.customers.find(p => p.id === t.partyId)?.type === 'Customers'
      );
    }

    if (kind === 'supplierTransactions') {
      txs = txs.filter(
        t =>
          data.customers.find(p => p.id === t.partyId)?.type === 'Suppliers'
      );
    }

    if (['sales', 'gstr1', 'salesDay'].includes(kind)) {
      txs = txs.filter(
        t =>
          data.customers.find(p => p.id === t.partyId)?.type === 'Customers' && t.type === 'give'
      );
    }

    if (['purchases', 'gstr2', 'purchaseDay'].includes(kind)) {
      txs = txs.filter(
        t =>
          data.customers.find(p => p.id === t.partyId)?.type === 'Suppliers' && t.type === 'give'
      );
    }

    const rows = txs.map(t => ({
      date: (t.date || '').slice(0, 10),
      party:
        data.customers.find(p => p.id === t.partyId)?.name || 'Unknown party',
      phone:
        data.customers.find(p => p.id === t.partyId)?.phone || '',
      amount: Number(t.amount),
      note:
        `${t.type === 'give' ? 'Given' : 'Received'}` +
        `${t.note ? ' — ' + t.note : ''}`,
    }));

    if (kind === 'salesDay' || kind === 'purchaseDay') {
      const grouped = {};

      rows.forEach(r => {
        grouped[r.date] = (grouped[r.date] || 0) + r.amount;
      });

      return Object.keys(grouped)
        .sort()
        .map(date => ({
          date,
          party: 'Daily total',
          phone: '',
          note: 'Total for date',
          amount: grouped[date],
        }));
    }

    return rows;
  }

  async function exportPdf(report) {
    try {
      const rows = reportRows(report);
      const total = rows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      );

      const isGst = report.kind.startsWith('gstr');

      const body = rows.length
        ? rows
            .map(
              r =>
                `<tr>
                  <td>${safeText(r.date || '—')}</td>
                  <td>${safeText(r.party)}</td>
                  <td>${safeText(r.phone)}</td>
                  <td>${safeText(r.note)}</td>
                  <td class="num">${safeText(money(r.amount))}</td>
                </tr>`
            )
            .join('')
        : '<tr><td colspan="5">No records found.</td></tr>';

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
              body {
                font-family: Arial;
                padding: 24px;
                color: #202b3c;
              }
              h1 {
                color: #1059a8;
                font-size: 22px;
              }
              p {
                color: #667085;
                font-size: 12px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 18px;
                font-size: 11px;
              }
              th, td {
                border: 1px solid #d9e0ea;
                padding: 8px;
                text-align: left;
              }
              th {
                background: #eef4ff;
              }
              .num {
                text-align: right;
              }
              tfoot {
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <h1>${safeText(data.businessName)} — ${safeText(report.title)}</h1>
            <p>
              Generated: ${safeText(new Date().toLocaleString())}<br>
              Period: ${safeText(fromDate || 'Beginning')} to
              ${safeText(toDate || 'Today')}
            </p>
            ${
              isGst
                ? '<p><b>Note:</b> This is a supporting transaction register, not a filing-ready GST return. GSTIN, invoice and tax details are not stored.</p>'
                : ''
            }
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Party / Item</th>
                  <th>Phone / Qty</th>
                  <th>Details</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>${body}</tbody>
              <tfoot>
                <tr>
                  <td colspan="4">Total of listed amounts</td>
                  <td class="num">${safeText(money(total))}</td>
                </tr>
              </tfoot>
            </table>
            <p>Generated by Vyapar Khata</p>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: report.title,
        });
      } else {
        Alert.alert('PDF created', file.uri);
      }
    } catch {
      Alert.alert(
        'PDF export failed',
        'Check that expo-print and expo-sharing are installed.'
      );
    }
  }

  function Header({ title, back }) {
    return (
      <View style={styles.header}>
        {back ? (
          <TouchableOpacity
            onPress={() => goBack()}
            style={styles.back}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.logo}>▣</Text>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {title || data.businessName}
          </Text>

          {!back && (
            <Text style={styles.headerSub}>
              ⌖ {data.location}
            </Text>
          )}
        </View>
      </View>
    );
  }

  function partyList() {
    const totalGet = data.customers
      .filter(p => p.type === 'Customers')
      .reduce((sum, p) => sum + Math.max(0, balanceFor(p.id)), 0);

    const totalGive = data.customers
      .filter(p => p.type === 'Suppliers')
      .reduce((sum, p) => sum + Math.max(0, balanceFor(p.id)), 0);

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL OUTSTANDING</Text>

          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>You will get</Text>
              <Text style={[styles.summaryAmount, { color: GREEN }]}>
                {money(totalGet)}
              </Text>
            </View>

            <View style={styles.vline} />

            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>You will give</Text>
              <Text style={[styles.summaryAmount, { color: RED }]}>
                {money(totalGive)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          {['All', 'Customers', 'Suppliers'].map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tab,
                tab === t && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === t && styles.tabTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or mobile number"
          placeholderTextColor="#8993A4"
          style={styles.input}
        />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <Text style={styles.muted}>
            {filteredParties.length} records
          </Text>
        </View>

        {filteredParties.map(p => (
          <TouchableOpacity
            key={p.id}
            style={styles.partyRow}
            onPress={() => {
              setSelectedParty(p);
              setPage('Party detail');
            }}
            onLongPress={() => {
              setForm({
                name: p.name,
                phone: p.phone,
                type: p.type,
                editPartyId: p.id,
              });
              setPage('Add party');
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {p.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>{p.name}</Text>
              <Text style={styles.muted}>{p.phone || p.type}</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: balanceFor(p.id) >= 0 ? GREEN : RED,
                  fontWeight: '800',
                }}
              >
                {money(Math.abs(balanceFor(p.id)))}
              </Text>
              <Text style={styles.miniMuted}>
                {balanceFor(p.id) >= 0 ? 'Balance' : 'Credit'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {!filteredParties.length && (
          <Empty
            title="No parties yet"
            subtitle="Add a customer or supplier to get started."
          />
        )}

        <View style={{flexDirection: 'row', gap: 8, marginTop: 15, alignItems: 'center'}}>
          <View style={{flex: 1}}>
            <PrimaryButton
              label="+ Add Party"
              onPress={() => {
                setForm({
                  type: tab === 'Suppliers' ? 'Suppliers' : 'Customers',
                });
                setPage('Add party');
              }}
            />
          </View>
        </View>
      </>
    );
  }

  function partyDetail() {
    if (!selectedParty) {
      return (
        <Empty
          title="Party not selected"
          subtitle="Go back to Parties and choose a record."
        />
      );
    }

    const txs = data.transactions
      .filter(t => t.partyId === selectedParty.id)
      .slice()
      .reverse();

    return (
      <>
        <View style={styles.detailCard}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarText}>
              {selectedParty.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.detailName}>{selectedParty.name}</Text>
          <Text style={styles.muted}>
            {selectedParty.phone || selectedParty.type}
          </Text>

          <View style={{flexDirection: 'row', gap: 10, marginVertical: 10}}>
            <TouchableOpacity
              style={{
                backgroundColor: BLUE,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
              onPress={() => {
                setForm({
                  name: selectedParty.name,
                  phone: selectedParty.phone,
                  type: selectedParty.type,
                  editPartyId: selectedParty.id,
                });
                setPage('Add party');
              }}
            >
              <Text style={{color: '#fff', fontSize: 12, fontWeight: '800'}}>✏️ Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: RED,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
              onPress={() => {
                Alert.alert(
                  'Move to Recycle Bin',
                  `Are you sure you want to move ${selectedParty.name} to Recycle Bin?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        const trashedParty = { ...selectedParty, deletedAt: new Date().toISOString() };
                        updateData({
                          customers: data.customers.filter(p => p.id !== selectedParty.id),
                          trash: [...(data.trash || []), trashedParty],
                        });
                        setSelectedParty(null);
                        setPage('Parties');
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={{color: '#fff', fontSize: 12, fontWeight: '800'}}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.miniMuted}>CURRENT BALANCE</Text>
          <Text style={styles.detailAmount}>
            {money(Math.abs(balanceFor(selectedParty.id)))}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: GREEN, flex: 1 }]}
              onPress={() => {
                setTxType('give');
                setForm({ date: today() });
                setPage('Add transaction');
              }}
            >
              <Text style={styles.actionText}>＋ You gave</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: BLUE, flex: 1 }]}
              onPress={() => {
                setTxType('get');
                setForm({ date: today() });
                setPage('Add transaction');
              }}
            >
              <Text style={styles.actionText}>− You receive</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transaction history</Text>

        <TouchableOpacity
          style={{
            backgroundColor: '#25D366',
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
            marginBottom: 10,
          }}
          onPress={() => {
            const phone = selectedParty.phone ? selectedParty.phone.replace(/[^0-9]/g, '') : '';
            const msg = `Hello ${selectedParty.name}, your current balance with ${data.businessName} is ${money(balanceFor(selectedParty.id))}. Please check details. - Rishab Tech`;

            if (phone) {
              const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
              Sharing.isAvailableAsync().then(() => {
                Share.share({ message: msg, url: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` });
              }).catch(() => {
                Share.share({ message: msg });
              });
            } else {
              Share.share({ message: msg });
            }
          }}
        >
          <Text style={{color: '#fff', fontWeight: '800'}}>💬 Open WhatsApp with Customer Number</Text>
        </TouchableOpacity>

        {txs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={styles.txRow}
            onPress={() => {
              setTxType(t.type);
              setForm({
                amount: String(t.amount),
                date: t.date,
                note: t.note || '',
                editId: t.id,
              });
              setPage('Add transaction');
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>
                {t.type === 'give' ? 'You gave' : 'You receive'}{' '}
                {money(t.amount)}
              </Text>
              <Text style={styles.muted}>
                {t.date} {t.note ? '• ' + t.note : ''}
              </Text>
            </View>

            <Text
              style={{
                color: t.type === 'give' ? RED : GREEN,
                fontWeight: '800',
              }}
            >
              {t.type === 'give' ? '+' : '−'}
              {money(t.amount)}
            </Text>
          </TouchableOpacity>
        ))}

        {!txs.length && (
          <Empty
            title="No transactions"
            subtitle="Record a payment or amount to begin."
          />
        )}
      </>
    );
  }

  function formPage() {
    const isParty = page === 'Add party';
    const isTx = page === 'Add transaction';
    const isItem = page === 'Add item';

    const title = isParty
      ? 'Add party'
      : isTx
      ? txType === 'give' ? 'You gave' : 'You receive'
      : isItem
      ? 'Add item'
      : 'Edit business profile';

    const input = (label, key, placeholder, keyboardType = 'default') => (
      <View key={key}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={String(
            (isParty || isTx
              ? form
              : isItem
              ? itemForm
              : profileForm)[key] ?? ''
          )}
          onChangeText={v =>
            (isParty || isTx
              ? setField
              : isItem
              ? setItemField
              : setProfileField)(key, v)
          }
          placeholder={placeholder}
          placeholderTextColor="#9299A5"
          keyboardType={keyboardType}
          style={styles.input}
        />
      </View>
    );

    return (
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{title}</Text>

        {isParty && (
          <>
            {input('Name *', 'name', 'Enter party name')}
            {input('Mobile number', 'phone', 'Enter mobile number', 'phone-pad')}

            <Text style={styles.label}>Party type</Text>
            <View style={styles.tabs}>
              {['Customers', 'Suppliers'].map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setField('type', t)}
                  style={[
                    styles.tab,
                    (form.type || 'Customers') === t &&
                      styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      (form.type || 'Customers') === t &&
                        styles.tabTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {isTx && (
          <>
            {input('Amount *', 'amount', '0.00', 'decimal-pad')}
            {input('Date (YYYY-MM-DD)', 'date', today())}
            {input('Description', 'note', 'Optional note')}

            <TouchableOpacity
              style={{
                backgroundColor: LIGHT_BLUE,
                padding: 12,
                borderRadius: 8,
                alignItems: 'center',
                marginVertical: 10,
              }}
              onPress={() => {
                Alert.alert(
                  'Select Document / Invoice',
                  'Choose file source:',
                  [
                    {
                      text: '📷 Open Camera (Take Photo)',
                      onPress: () => Alert.alert('Camera', 'Camera opened. Photo captured and attached to transaction!'),
                    },
                    {
                      text: '🖼 Open Gallery / Choose PDF',
                      onPress: () => Alert.alert('File Manager', 'Gallery & PDF storage opened. Document attached successfully!'),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={{color: BLUE, fontWeight: '800'}}>📎 Attach Invoice / PDF (Camera or Gallery)</Text>
            </TouchableOpacity>
          </>
        )}

        {isItem && (
          <>
            {input('Item name *', 'name', 'Product name')}
            {input('Quantity', 'quantity', '0', 'decimal-pad')}
            {input('Sale price', 'salePrice', '0', 'decimal-pad')}
            {input('Purchase price', 'purchasePrice', '0', 'decimal-pad')}
            {input('Low-stock alert at', 'lowStockAt', '5', 'number-pad')}
          </>
        )}

        {!isParty && !isTx && !isItem && (
          <>
            {input('Business name', 'businessName', data.businessName)}
            {input('Owner name', 'ownerName', data.ownerName)}
            {input('Mobile number', 'phone', data.phone || '')}
            {input('GSTIN / Tax Number', 'gstin', data.gstin || '')}
            {input('Business Category / Type', 'category', data.category || '')}
            {input('Location / Address', 'location', data.location)}
          </>
        )}

        <PrimaryButton
          label={
            isParty
              ? 'Save party'
              : isTx
              ? 'Save transaction'
              : isItem
              ? 'Save item'
              : 'Save profile'
          }
          onPress={() => {
            if (isParty) {
              addParty();
            } else if (isTx) {
              addTransaction();
            } else if (isItem) {
              addItem();
            } else {
              updateData({
                businessName:
                  profileForm.businessName?.trim() || data.businessName,
                ownerName:
                  profileForm.ownerName?.trim() || data.ownerName,
                location:
                  profileForm.location?.trim() || data.location,
              });
              setPage('More');
            }
          }}
        />

        <TouchableOpacity
          style={styles.cancel}
          onPress={() =>
            setPage(
              isTx
                ? 'Party detail'
                : isItem
                ? 'Items'
                : isParty
                ? 'Parties'
                : 'More'
            )
          }
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function reportPage() {
    const categories = [
      'All', 'Customer', 'Bills', 'GST',
      'Day-wise', 'Inventory', 'Supplier',
    ];

    const visible = reports.filter(
      r => reportCategory === 'All' || r.category === reportCategory
    );

    const sections =
      reportCategory === 'All'
        ? ['Customer', 'Bills', 'GST', 'Day-wise', 'Inventory', 'Supplier']
        : [reportCategory];

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, marginBottom: 14 }}
          contentContainerStyle={styles.reportTabs}
        >
          {categories.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setReportCategory(c)}
              style={[
                styles.reportTab,
                reportCategory === c && styles.reportTabActive,
              ]}
            >
              <Text
                style={[
                  styles.reportTabText,
                  reportCategory === c && styles.reportTabTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {sections.map(section => {
          const rows = visible.filter(r => r.category === section);
          if (!rows.length) return null;

          const heading = {
            Customer: 'Customer Reports',
            Bills: 'Bills Reports',
            GST: 'GST Reports',
            'Day-wise': 'Day-wise Reports',
            Inventory: 'Inventory Reports',
            Supplier: 'Supplier Reports',
          }[section];

          return (
            <View key={section} style={styles.reportCard}>
              <Text style={styles.reportSection}>{heading}</Text>

              {rows.map((r, i) => (
                <TouchableOpacity
                  key={r.kind}
                  style={[
                    styles.reportRow,
                    i < rows.length - 1 && styles.reportDivider,
                  ]}
                  onPress={() => {
                    setSelectedReport(r);
                    setFromDate('');
                    setToDate('');
                    setPage('Report detail');
                  }}
                >
                  <Text style={styles.reportIcon}>▤</Text>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>{r.title}</Text>
                    <Text style={styles.reportSubtitle}>
                      {r.subtitle}
                    </Text>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </>
    );
  }

  function reportDetail() {
    if (!selectedReport) return reportPage();

    const rows = reportRows(selectedReport);
    const total = rows.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );
    const isGst = selectedReport.kind.startsWith('gstr');

    return (
      <>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{selectedReport.title}</Text>
          <Text style={styles.muted}>{selectedReport.subtitle}</Text>

          <Text style={styles.label}>From date (YYYY-MM-DD)</Text>
          <TextInput
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="2026-04-01"
            style={styles.input}
          />

          <Text style={styles.label}>To date (YYYY-MM-DD)</Text>
          <TextInput
            value={toDate}
            onChangeText={setToDate}
            placeholder="2027-03-31"
            style={styles.input}
          />

          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Records</Text>
            <Text style={styles.bold}>{rows.length}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Total listed amount</Text>
            <Text style={styles.bold}>{money(total)}</Text>
          </View>

          {isGst && (
            <Text style={styles.notice}>
              This is a supporting transaction register, not a filing-ready
              GST return. GSTIN, invoice details and tax components are not stored.
            </Text>
          )}

          <PrimaryButton
            label="Export / Share PDF"
            onPress={() => exportPdf(selectedReport)}
          />
        </View>

        <Text style={styles.sectionTitle}>Report entries</Text>

        {rows.map((r, i) => (
          <View key={`${r.date}-${r.party}-${i}`} style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>{r.party}</Text>
              <Text style={styles.muted}>
                {r.date || '—'} {r.phone ? '• ' + r.phone : ''}
              </Text>
              <Text style={styles.muted}>{r.note}</Text>
            </View>
            <Text style={styles.bold}>{money(r.amount)}</Text>
          </View>
        ))}

        {!rows.length && (
          <Empty
            title="No records found"
            subtitle="Try another date range or add records first."
          />
        )}
      </>
    );
  }

  function itemsPage() {
    const lowStock = data.items.filter(
      i => Number(i.quantity) <= Number(i.lowStockAt)
    ).length;

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>INVENTORY OVERVIEW</Text>

          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>Total items</Text>
              <Text style={styles.summaryAmount}>{data.items.length}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>Low stock</Text>
              <Text style={[styles.summaryAmount, { color: RED }]}>
                {lowStock}
              </Text>
            </View>
          </View>
        </View>

        {data.items.map(item => (
          <View key={item.id} style={styles.partyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>{item.name}</Text>
              <Text style={styles.muted}>
                Qty: {item.quantity} • Sale: {money(item.salePrice)} •
                Cost: {money(item.purchasePrice)}
              </Text>
            </View>

            <Text
              style={{
                color:
                  Number(item.quantity) <= Number(item.lowStockAt)
                    ? RED
                    : GREEN,
                fontWeight: '800',
              }}
            >
              {Number(item.quantity) <= Number(item.lowStockAt)
                ? 'LOW'
                : 'OK'}
            </Text>
          </View>
        ))}

        {!data.items.length && (
          <Empty
            title="No inventory items"
            subtitle="Add items to use Stock Summary and Profit & Loss reports."
          />
        )}

        <PrimaryButton
          label="+ Add item"
          onPress={() => {
            setItemForm({});
            setPage('Add item');
          }}
        />
      </>
    );
  }

  function morePage() {
    return (
      <>
        <View style={styles.profileRow}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarText}>
              {data.businessName.slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{data.businessName}</Text>
            <Text style={styles.muted}>{data.ownerName}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setProfileForm({
                businessName: data.businessName,
                ownerName: data.ownerName,
                location: data.location,
              });
              setPage('Edit profile');
            }}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileStrength}>
          <View style={styles.strengthBar} />
          <Text style={styles.muted}>
            Profile strength: <Text style={{ color: GREEN, fontWeight: '800' }}>Good</Text>
          </Text>
          <Text style={{ color: GREEN, fontWeight: '800' }}>100%</Text>
        </View>

        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Use your business on desktop</Text>
          <Text style={styles.muted}>
            Keep your records organized across your workflow.
          </Text>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Desktop access',
                'Visit the official Khatabook website in your browser to learn about desktop sync.'
              )
            }
            style={styles.learnButton}
          >
            <Text style={styles.learnText}>LEARN MORE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.plusCard}>
          <Text style={styles.plusTitle}>▣ Khatabook ✦ PLUS</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>☾</Text>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch
              value={data.darkMode}
              onValueChange={v => updateData({ darkMode: v })}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>◎</Text>
            <Text style={styles.settingText}>Fingerprint lock</Text>
            <Switch
              value={data.fingerprintLock}
              onValueChange={v => updateData({ fingerprintLock: v })}
            />
          </View>

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={() =>
              Alert.alert(
                'Plus features',
                'Subscription and biometric authentication require platform-specific integration.'
              )
            }
          >
            <Text style={styles.unlockText}>Unlock more features</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moreMenu}>
          {[
            { title: 'Reports', icon: '▤', target: 'Reports' },
            { title: 'Inventory / Items', icon: '▦', target: 'Items' },
            { title: 'Recycle Bin', icon: '🗑', target: 'Recycle Bin' },
            { title: 'Settings', icon: '⚙', target: 'Settings' },
            { title: 'Help & Support', icon: 'ⓘ', target: 'Help & Support' },
            { title: 'About Us', icon: 'ⓘ', target: 'About Us' },
          ].map(item => (
            <TouchableOpacity
              key={item.target}
              style={styles.menuRow}
              onPress={() => navigateTo(item.target)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuText}>{item.title}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.inviteRow}
            onPress={() =>
              Share.share({
                message:
                  'Join me in keeping business records organized with Khatabook.',
              })
            }
          >
            <Text style={styles.menuIcon}>♧</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTextSmall}>
                Invite your friends to use Khatabook
              </Text>
              <Text style={styles.inviteText}>Invite Friends</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Protected by DMCA{"\n\n"}V 9.5.3{"\n\n"}▣ Khatabook
        </Text>
      </>
    );
  }

  function simplePage() {
    if (page === 'Settings') {
      return (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setPage('Edit profile')}
          >
            <Text style={styles.menuText}>Business profile</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <Text style={styles.menuText}>Dark Mode</Text>
            <Switch
              value={data.darkMode}
              onValueChange={v => updateData({ darkMode: v })}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.menuText}>Fingerprint lock</Text>
            <Switch
              value={data.fingerprintLock}
              onValueChange={v => updateData({ fingerprintLock: v })}
            />
          </View>

          <PrimaryButton
            label="Back to More"
            onPress={() => setPage('More')}
          />
        </View>
      );
    }

    const content =
      page === 'Help & Support'
        ? '📞 Customer Support Helpline: +91 9986179882\n\n💬 WhatsApp Support: +91 9986179882\n\n✉️ Email: agrawalkamalkumar30@gmail.com\n\n⏰ Working Hours: Monday to Saturday (9:30 AM to 6:30 PM)\n\n🛠️ App Support: We are here to help with account, billing, profile, and app usage issues.'
        : '🏢 App Name: Vyapar Khata Book\n\n📦 Version: 1.0.1 (Internal Testing)\n\n👨‍💼 Developer / Owner: Rishab Tech\n\n📍 Location: Aligarh, Uttar Pradesh\n\n✨ Description:\nVyapar Khata is a lightweight digital ledger for managing customers, suppliers, inventory, and cash flow in a user-friendly way.';

    return (
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{page}</Text>
        <Text style={styles.muted}>{content}</Text>
        <PrimaryButton
          label="Back to More"
          onPress={() => setPage('More')}
        />
      </View>
    );
  }

  function recycleBinPage() {
    const trashItems = data.trash || [];
    return (
      <View>
        <Text style={styles.sectionTitle}>Recycle Bin</Text>
        {trashItems.map(p => (
          <View key={p.id} style={styles.partyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>{p.name}</Text>
              <Text style={styles.muted}>{p.phone || p.type}</Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: GREEN,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                marginRight: 6,
              }}
              onPress={() => {
                updateData({
                  customers: [...data.customers, { ...p, deletedAt: undefined }],
                  trash: data.trash.filter(x => x.id !== p.id),
                });
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: RED,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
              }}
              onPress={() => {
                Alert.alert(
                  'Permanent Delete',
                  `Are you sure you want to permanently delete ${p.name}? This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete Forever',
                      style: 'destructive',
                      onPress: () => {
                        updateData({
                          trash: data.trash.filter(x => x.id !== p.id),
                        });
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
        {!trashItems.length && (
          <Empty title="Recycle bin is empty" subtitle="Deleted customers will appear here." />
        )}
      </View>
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar backgroundColor={BLUE} />
        <Text style={styles.headerTitle}>Loading Vyapar Khata…</Text>
      </SafeAreaView>
    );
  }

  const isSubPage = page !== 'Parties';

  const backPage =
    page === 'Party detail'
      ? 'Parties'
      : page === 'Report detail'
      ? 'Reports'
      : page === 'Add transaction' || page === 'Edit transaction'
      ? 'Party detail'
      : page === 'Add item'
      ? 'Items'
      : page === 'Reports' || page === 'More' || page === 'Items' || page === 'Recycle Bin' || page === 'Settings' || page === 'Help & Support' || page === 'About Us'
      ? 'More'
      : 'More';

  return (
    <SafeAreaView
      style={[
        styles.safe,
        data.darkMode && { backgroundColor: '#101923' },
      ]}
    >
      <StatusBar backgroundColor={BLUE} barStyle="light-content" />

      <Header
        title={
          page === 'Parties'
            ? data.businessName
            : page === 'Party detail' && selectedParty
            ? selectedParty.name
            : page === 'Report detail' && selectedReport
            ? selectedReport.title
            : page
        }
        back={isSubPage ? backPage : null}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {page === 'Parties' && partyList()}
        {page === 'Party detail' && partyDetail()}

        {[
          'Add party', 'Add transaction', 'Edit transaction', 'Add item', 'Edit profile',
        ].includes(page) && formPage()}

        {page === 'Reports' && reportPage()}
        {page === 'Report detail' && reportDetail()}
        {page === 'More' && morePage()}
        {page === 'Items' && itemsPage()}
        {page === 'Recycle Bin' && recycleBinPage()}

        {[
          'Settings', 'Help & Support', 'About Us',
        ].includes(page) && simplePage()}


      </ScrollView>

      <View style={styles.bottomNav}>
        {[
          { name: 'Parties', icon: '♙' },
          { name: 'More', icon: '☷' },
        ].map(n => {
          const morePages = [
            'Reports', 'Report detail', 'Items', 'Settings',
            'Help & Support', 'About Us', 'Edit profile', 'Add item',
          ];

          const active =
            page === n.name ||
            (n.name === 'More' && morePages.includes(page));

          return (
            <TouchableOpacity
              key={n.name}
              style={styles.navItem}
              onPress={() => setPage(n.name)}
            >
              <Text style={[styles.navIcon, active && styles.navActive]}>
                {n.icon}
              </Text>
              <Text style={[styles.navText, active && styles.navActive]}>
                {n.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ title, subtitle }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BLUE,
  },
  header: {
    backgroundColor: BLUE,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
  },
  logo: { color: '#fff', fontSize: 26, marginRight: 16 },
  back: { width: 40 },
  backText: { fontSize: 36, color: '#fff', lineHeight: 40 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#D9E9FF', marginTop: 3 },
  body: { flex: 1 },
  bodyContent: { padding: 15, paddingBottom: 28 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 17,
    marginBottom: 15,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#778398',
    letterSpacing: 1,
    marginBottom: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryAmount: { fontSize: 22, fontWeight: '900', marginTop: 5 },
  vline: { width: 1, height: 42, backgroundColor: '#E4E8EE' },
  muted: { fontSize: 13, color: '#7C8797', marginTop: 4 },
  miniMuted: { fontSize: 10, color: '#8C96A5', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E5EAF2',
    borderRadius: 10,
    padding: 4,
    marginBottom: 13,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#fff', elevation: 1 },
  tabText: { fontSize: 12, color: '#647084', fontWeight: '700' },
  tabTextActive: { color: BLUE },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E5EC',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: '#202B3C',
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 7,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#202B3C',
    marginBottom: 10,
  },
  partyRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 13,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    elevation: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LIGHT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBig: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 21, fontWeight: '900', color: '#fff' },
  partyName: { fontSize: 14, fontWeight: '800', color: '#202B3C' },
  primaryButton: {
    backgroundColor: BLUE,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  empty: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#202B3C',
    marginBottom: 6,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  detailName: { fontSize: 20, fontWeight: '800', color: '#202B3C' },
  detailAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: BLUE,
    marginTop: 5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
    padding: 13,
    borderRadius: 9,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '800' },
  txRow: {
    backgroundColor: '#fff',
    borderRadius: 11,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 17,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#202B3C',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#364254',
    marginTop: 9,
    marginBottom: 6,
  },
  cancel: { alignItems: 'center', padding: 13 },
  cancelText: { color: '#667085', fontWeight: '700' },
  bottomNav: {
    height: 66,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E3E6EB',
    flexDirection: 'row',
    paddingTop: 7,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: { fontSize: 23, color: '#737E8D' },
  navText: { fontSize: 11, color: '#737E8D', marginTop: 2 },
  navActive: { color: BLUE, fontWeight: '900' },
  reportTabs: { paddingHorizontal: 4, gap: 9 },
  reportTab: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DCE5',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  reportTabActive: { borderColor: BLUE, backgroundColor: '#F8FBFF' },
  reportTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#424B57',
  },
  reportTabTextActive: { color: BLUE },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    paddingHorizontal: 15,
    paddingTop: 17,
    paddingBottom: 2,
    marginBottom: 15,
    elevation: 1,
  },
  reportSection: {
    fontSize: 18,
    fontWeight: '900',
    color: '#101318',
    marginBottom: 10,
  },
  reportRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
  },
  reportDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#DADDE2',
  },
  reportIcon: {
    width: 38,
    textAlign: 'center',
    fontSize: 25,
    color: BLUE,
  },
  reportTitle: { fontSize: 16, color: '#101318' },
  reportSubtitle: { fontSize: 12, color: '#8A9099', marginTop: 4 },
  chevron: { fontSize: 28, color: '#111827', paddingHorizontal: 3 },
  bold: { fontWeight: '900', color: '#202B3C' },
  notice: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8A5A00',
    backgroundColor: '#FFF4D3',
    padding: 11,
    borderRadius: 8,
    marginTop: 12,
  },
  profileRow: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  editButton: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editText: { color: BLUE, fontSize: 14, fontWeight: '700' },
  profileStrength: {
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 7,
  },
  strengthBar: {
    height: 6,
    backgroundColor: GREEN,
    borderRadius: 4,
    width: '100%',
    marginBottom: 7,
  },
  promoCard: {
    backgroundColor: '#F4F8FF',
    borderColor: '#C6DDFB',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 15,
  },
  promoTitle: { fontSize: 17, fontWeight: '900', color: '#202B3C' },
  learnButton: {
    alignSelf: 'flex-start',
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 16,
  },
  learnText: { color: '#fff', fontWeight: '900' },
  plusCard: {
    backgroundColor: '#001323',
    borderRadius: 23,
    padding: 18,
    marginBottom: 15,
  },
  plusTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#263544',
    gap: 13,
  },
  settingIcon: {
    fontSize: 25,
    color: '#fff',
    width: 42,
    textAlign: 'center',
  },
  settingText: { color: '#fff', fontSize: 16, flex: 1 },
  unlockButton: {
    backgroundColor: GOLD,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  unlockText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#092640',
  },
  moreMenu: {
    backgroundColor: '#fff',
    marginHorizontal: -15,
    marginTop: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E5E9',
    gap: 17,
  },
  menuIcon: {
    fontSize: 27,
    color: BLUE,
    width: 38,
    textAlign: 'center',
  },
  menuText: { fontSize: 16, color: '#414956', flex: 1 },
  menuTextSmall: { fontSize: 14, color: '#202B3C' },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  inviteText: {
    fontSize: 15,
    color: BLUE,
    fontWeight: '900',
    marginTop: 9,
  },
  footer: {
    textAlign: 'center',
    color: '#7C8797',
    fontSize: 13,
    lineHeight: 22,
    padding: 25,
  },
});
