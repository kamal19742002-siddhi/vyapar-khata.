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
