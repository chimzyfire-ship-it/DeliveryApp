import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Keyboard, KeyboardAvoidingView, LayoutAnimation, Linking, Modal, Platform, RefreshControl, SafeAreaView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../supabase';

// Enable smooth animations
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// === THEME CONFIGURATION (TITANIUM 2025) ===
const THEME = {
  primary: '#FF6B00', // Brand Orange
  darkBg: '#050505', // True OLED Black
  cardBg: '#121214', // Matte Dark Grey
  glass: 'rgba(20, 20, 22, 0.98)',
  text: '#FFFFFF',
  subtext: '#71717A',
  success: '#10B981', 
  danger: '#EF4444',
  accent: '#3B82F6',
  surface: '#1E1E22'
};

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const SCREEN_HEIGHT = Dimensions.get('window').height;

// === UTILITIES ===
const generatePIN = () => Math.floor(1000 + Math.random() * 9000).toString();
const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const animateUI = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);

// Polyline Decoder
const decode = (t) => {let n=0,o=0,e=0,r=0,l=[],h=0,i=0,a=null,c=1e5;for(;n<t.length;){a=null,h=0,i=0;do{a=t.charCodeAt(n++)-63,i|=(31&a)<<h,h+=5}while(a>=32);e+=1&i?~(i>>1):i>>1,h=i=0;do{a=t.charCodeAt(n++)-63,i|=(31&a)<<h,h+=5}while(a>=32);r+=1&i?~(i>>1):i>>1,l.push({latitude:e/c,longitude:r/c})}return l};

const openGoogleMaps = (lat, lng, label) => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${lat},${lng}`;
  const url = Platform.select({ ios: `${scheme}${label}@${latLng}`, android: `${scheme}${latLng}(${label})` });
  Linking.openURL(url);
};

const openWhatsApp = (phone, text) => {
  Linking.openURL(`whatsapp://send?text=${text}&phone=${phone}`);
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180)) * Math.cos(lat2*(Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return parseFloat((R * c).toFixed(1));
};

// === COMPONENT: TOAST ===
const Toast = ({ message, type, visible }) => {
  if (!visible) return null;
  const bgColor = type === 'success' ? THEME.success : type === 'error' ? THEME.danger : THEME.primary;
  return (
    <View style={[styles.toastContainer, { backgroundColor: bgColor }]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
};

// === COMPONENT: ORDER TIMELINE ===
const OrderTimeline = ({ status }) => {
  const steps = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'in_progress', label: 'Rider Assigned' },
    { key: 'arrived', label: 'Rider Arrived' },
    { key: 'completed', label: 'Delivered' }
  ];
  const currentIndex = steps.findIndex(s => s.key === status);
  return (
    <View style={styles.timelineContainer}>
      {steps.map((step, i) => {
        const active = i <= currentIndex;
        return (
          <View key={i} style={styles.timelineRow}>
            <View style={{alignItems:'center', marginRight: 15}}>
               <View style={[styles.dot, active && {backgroundColor:THEME.success, borderColor:THEME.success}]}/>
               {i < steps.length - 1 && <View style={[styles.line, active && {backgroundColor:THEME.success}]} />}
            </View>
            <View style={{paddingBottom: 25}}>
               <Text style={[styles.timelineText, active && {color:THEME.text, fontWeight:'bold'}]}>{step.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// === COMPONENT: EARNINGS GRAPH ===
const EarningsGraph = ({ data }) => {
  const max = Math.max(...data, 5000); 
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={styles.graphContainer}>
      {data.map((val, i) => (
        <View key={i} style={styles.barWrapper}>
          <View style={[styles.bar, { height: (val / max) * 100 + 10, backgroundColor: val > 0 ? THEME.primary : '#333' }]} />
          <Text style={styles.barLabel}>{days[i]}</Text>
        </View>
      ))}
    </View>
  );
};

// === COMPONENT: STAT BADGE ===
const StatBadge = ({ icon, label, value, color }) => (
    <View style={[styles.statBadge, { borderColor: color || '#333' }]}>
        <Text style={{fontSize:20}}>{icon}</Text>
        <Text style={{color:'#FFF', fontWeight:'bold', fontSize:16, marginTop:5}}>{value}</Text>
        <Text style={{color:THEME.subtext, fontSize:10}}>{label}</Text>
    </View>
);

// === MAIN APP ===
export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    animateUI(); setToast({ visible: true, message, type });
    setTimeout(() => { animateUI(); setToast({ ...toast, visible: false }); }, 3000);
  };

  const fetchRole = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data && data.role) setUserRole(data.role);
    } catch (e) { console.log(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if (session) fetchRole(session.user.id); else setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); if (session) fetchRole(session.user.id); else { setUserRole(null); setLoading(false); }
    });
  }, []);

  if (loading) return (
    <View style={styles.loadingScreen}>
        <Text style={{fontSize: 50, marginBottom: 20}}>📦</Text>
        <ActivityIndicator size="large" color={THEME.primary}/>
        <Text style={{color:THEME.subtext, marginTop: 20, letterSpacing: 2}}>HOSA LOGISTICS</Text>
    </View>
  );

  if (!session) return <AuthScreen showToast={showToast} />;
  if (userRole === 'admin') return <AdminDashboard />;
  if (userRole === 'driver') return <RiderApp session={session} showToast={showToast} />;
  return <CustomerApp session={session} showToast={showToast} />;
}

// ================== 1. AUTH SCREEN ==================
function AuthScreen({ showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleAuth = async () => {
    triggerHaptic();
    if(!email || !password) return showToast("Please fill all fields", "error");
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Welcome Back!", "success");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id, email, role: 'customer', full_name: fullName, phone_number: phone, payment_method: 'Cash'
          });
          showToast("Account Created!", "success");
        }
      }
    } catch (e) { showToast(e.message, "error"); } 
    finally { setLoading(false); }
  };

  const handleBiometricLogin = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Login to Hosa Logistics' });
    if (result.success) showToast("Biometrics Verified", "success");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.authContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.brandSection}>
        <View style={styles.logoBadge}><Text style={{fontSize:40}}>📦</Text></View>
        <Text style={styles.logoText}>HOSA</Text>
        <Text style={styles.logoSub}>LOGISTICS OS</Text>
      </View>
      <View style={styles.authCard}>
        <Text style={styles.welcomeText}>{isLogin ? "SECURE ACCESS" : "NEW ACCOUNT"}</Text>
        {!isLogin && (
           <View style={{flexDirection:'row', gap:10}}>
              <TextInput style={[styles.input, {flex:1}]} placeholder="Name" placeholderTextColor={THEME.subtext} value={fullName} onChangeText={setFullName} />
              <TextInput style={[styles.input, {flex:1}]} placeholder="Phone" placeholderTextColor={THEME.subtext} value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
           </View>
        )}
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={THEME.subtext} autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={THEME.subtext} secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}>
          {loading ? <ActivityIndicator color="#000"/> : <Text style={styles.btnText}>{isLogin ? "AUTHENTICATE" : "REGISTER"}</Text>}
        </TouchableOpacity>
        {isLogin && (<TouchableOpacity onPress={handleBiometricLogin} style={styles.bioBtn}><Text style={{fontSize:24}}>👤</Text></TouchableOpacity>)}
        <TouchableOpacity onPress={() => { triggerHaptic(); animateUI(); setIsLogin(!isLogin); }}><Text style={styles.linkText}>{isLogin ? "Create Account" : "Back to Login"}</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ================== 2. ADMIN DASHBOARD ==================
function AdminDashboard() {
  const [missions, setMissions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, active: 0, fleet: 0 });
  const [activeTab, setActiveTab] = useState('live'); // 'live', 'riders', 'history'
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  useEffect(() => { 
    const fetchData = async () => {
      // 1. All Missions
      const { data: mData } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
      if(mData) {
        setMissions(mData);
        const rev = mData.filter(m => m.status === 'completed').reduce((acc, curr) => acc + (parseInt(curr.price.replace(/\D/g, '')) || 0), 0);
        setStats({ 
            revenue: rev, 
            active: mData.filter(m => m.status === 'in_progress' || m.status === 'pending').length, 
            fleet: drivers.length 
        });
      }
      // 2. All Riders
      const { data: dData } = await supabase.from('profiles').select('*').eq('role', 'driver');
      if(dData) setDrivers(dData);
    };
    fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); 
  }, [drivers.length]);

  const toggleExpand = () => { triggerHaptic(); animateUI(); setIsExpanded(!isExpanded); };

  // Filter Data based on Tab
  const getDisplayData = () => {
      if(activeTab === 'live') return missions.filter(m => m.status !== 'completed');
      if(activeTab === 'history') return missions.filter(m => m.status === 'completed');
      if(activeTab === 'riders') return drivers;
      return [];
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={{ latitude: 4.8156, longitude: 7.0498, latitudeDelta: 0.15, longitudeDelta: 0.15 }} customMapStyle={DARK_MAP_STYLE} provider={PROVIDER_DEFAULT}>
        {/* Active Missions */}
        {missions.filter(m => m.status !== 'completed').map(m => (m.pickup_lat && <Marker key={m.id} coordinate={{latitude: m.pickup_lat, longitude: m.pickup_lng}} pinColor={m.status === 'pending' ? 'orange' : '#00FF00'} />))}
        {/* Riders */}
        {drivers.map(d => (
            <Marker key={d.id} coordinate={{latitude: d.home_lat || 4.8156, longitude: d.home_lng || 7.0498}} opacity={d.is_online ? 1 : 0.5}>
                <View style={{backgroundColor:THEME.cardBg, padding:5, borderRadius:10, borderWidth:1, borderColor: d.is_online ? THEME.success : '#666'}}>
                    <Text style={{fontSize:15}}>{d.is_online ? '🛵' : '💤'}</Text>
                </View>
            </Marker>
        ))}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={{flex: 1}}>
        <View style={styles.glassHeader}>
           <Text style={styles.headerTitle}>H O S A</Text>
           <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtnPill}><Text style={styles.logoutText}>🛑 LOGOUT</Text></TouchableOpacity>
        </View>
        <View style={styles.kpiContainer}>
           <View style={styles.kpiCard}><Text style={styles.kpiLabel}>REVENUE</Text><Text style={styles.kpiValue}>₦{stats.revenue.toLocaleString()}</Text></View>
           <View style={styles.kpiCard}><Text style={styles.kpiLabel}>ACTIVE</Text><Text style={[styles.kpiValue, {color: THEME.success}]}>{stats.active}</Text></View>
           <View style={styles.kpiCard}><Text style={styles.kpiLabel}>FLEET</Text><Text style={[styles.kpiValue, {color: THEME.primary}]}>{drivers.length}</Text></View>
        </View>
        
        {/* SLIDING DOCK */}
        <View style={[styles.bottomSheet, {height: isExpanded ? '70%' : '35%'}]}>
           <TouchableOpacity onPress={toggleExpand} style={{alignSelf:'center', width:'100%', alignItems:'center', paddingBottom:10}}>
               <View style={{width:40, height:4, backgroundColor:'#444', borderRadius:2, marginBottom:5}} />
               <Text style={{color:'#666', fontSize:10}}>{isExpanded ? "▼ MINIMIZE" : "▲ EXPAND"}</Text>
           </TouchableOpacity>
           
           <View style={{flexDirection:'row', marginBottom:15, borderBottomWidth:1, borderBottomColor:'#333'}}>
               <TouchableOpacity onPress={()=>setActiveTab('live')} style={[styles.tabHeader, activeTab==='live' && styles.activeTabHeader]}><Text style={{color: activeTab==='live'?THEME.primary:'#666', fontWeight:'bold'}}>LIVE FEED</Text></TouchableOpacity>
               <TouchableOpacity onPress={()=>setActiveTab('riders')} style={[styles.tabHeader, activeTab==='riders' && styles.activeTabHeader]}><Text style={{color: activeTab==='riders'?THEME.primary:'#666', fontWeight:'bold'}}>FLEET</Text></TouchableOpacity>
               <TouchableOpacity onPress={()=>setActiveTab('history')} style={[styles.tabHeader, activeTab==='history' && styles.activeTabHeader]}><Text style={{color: activeTab==='history'?THEME.primary:'#666', fontWeight:'bold'}}>HISTORY</Text></TouchableOpacity>
           </View>

           <FlatList 
             data={getDisplayData()} 
             keyExtractor={item => item.id} 
             ListEmptyComponent={<View style={{alignItems:'center', marginTop:20}}><Text style={{fontSize:30}}>📂</Text><Text style={{color:'#666', marginTop:10}}>NO DATA FOUND</Text></View>}
             renderItem={({ item }) => {
                 if (activeTab === 'riders') {
                     return (
                         <View style={styles.adminListRow}>
                            <View style={{width:10, height:10, borderRadius:5, backgroundColor: item.is_online ? THEME.success : '#444', marginRight:10}} />
                            <View style={{flex:1}}><Text style={{color:'#FFF', fontWeight:'bold'}}>{item.full_name || 'Rider'}</Text><Text style={{color:'#666', fontSize:10}}>{item.is_online ? 'ONLINE' : 'OFFLINE'}</Text></View>
                            <TouchableOpacity onPress={()=>openWhatsApp(item.phone_number, "Admin Check")} style={[styles.smallBtn, {backgroundColor:'#333'}]}><Text style={{fontSize:12}}>📞</Text></TouchableOpacity>
                         </View>
                     );
                 } else {
                     // Missions (Live or History)
                     return (
                         <View style={styles.adminListRow}>
                            <View style={{flex:1}}>
                                <Text style={{color:'#FFF', fontWeight:'bold', fontSize:14}} numberOfLines={1}>{item.dropoff}</Text>
                                <Text style={{color:'#666', fontSize:10}} numberOfLines={1}>To: {item.pickup}</Text>
                            </View>
                            <View style={{alignItems:'flex-end'}}>
                                <Text style={{color: THEME.primary, fontWeight:'bold'}}>{item.price}</Text>
                                <Text style={{color: item.status==='completed'?THEME.success:'orange', fontSize:9, fontWeight:'900'}}>{item.status.toUpperCase()}</Text>
                            </View>
                         </View>
                     );
                 }
             }}
           />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ================== 3. CUSTOMER APP ==================
function CustomerApp({ session, showToast }) {
  const [currentTab, setCurrentTab] = useState('home');
  const [profile, setProfile] = useState({});
  const [myOrders, setMyOrders] = useState([]);

  useEffect(() => { fetchProfile(); fetchOrders(); }, []);

  const fetchProfile = async () => { const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single(); if(data) setProfile(data); }
  const fetchOrders = async () => { const { data } = await supabase.from('missions').select('*, profiles:driver_id(full_name, phone_number)').order('created_at', { ascending: false }); setMyOrders(data || []); };
  const switchTab = (tab) => { triggerHaptic(); animateUI(); setCurrentTab(tab); };

  return (
    <View style={styles.container}>
      <View style={{flex: 1}}>
        {currentTab === 'home' && <HomeScreen session={session} profile={profile} refreshProfile={fetchProfile} refreshOrders={fetchOrders} showToast={showToast} />}
        {currentTab === 'orders' && <OrdersScreen orders={myOrders} refresh={fetchOrders} showToast={showToast} />}
        {currentTab === 'account' && <AccountScreen session={session} profile={profile} refreshProfile={fetchProfile} showToast={showToast} />}
      </View>
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity onPress={() => switchTab('home')} style={styles.tabBtn}><Text style={{fontSize: 22, opacity: currentTab==='home'?1:0.4}}>🚀</Text>{currentTab==='home' && <View style={styles.activeDot} />}</TouchableOpacity>
          <TouchableOpacity onPress={() => switchTab('orders')} style={styles.tabBtn}><Text style={{fontSize: 22, opacity: currentTab==='orders'?1:0.4}}>📦</Text>{currentTab==='orders' && <View style={styles.activeDot} />}</TouchableOpacity>
          <TouchableOpacity onPress={() => switchTab('account')} style={styles.tabBtn}><Text style={{fontSize: 22, opacity: currentTab==='account'?1:0.4}}>👤</Text>{currentTab==='account' && <View style={styles.activeDot} />}</TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// --- TAB 1: HOME ---
function HomeScreen({ session, profile, refreshProfile, refreshOrders, showToast }) {
  const mapRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [distance, setDistance] = useState(0);
  const [price, setPrice] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [vehicle, setVehicle] = useState('bike');
  const [activeField, setActiveField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ghostDrivers, setGhostDrivers] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
           let location = await Location.getCurrentPositionAsync({});
           if(mapRef.current) mapRef.current.animateToRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
           setGhostDrivers([
               {id:1, lat: location.coords.latitude + 0.002, lng: location.coords.longitude - 0.002},
               {id:2, lat: location.coords.latitude - 0.003, lng: location.coords.longitude + 0.001},
               {id:3, lat: location.coords.latitude + 0.001, lng: location.coords.longitude + 0.004}
           ]);
        }
      } catch (e) { console.log(e); }
    })();
  }, []);

  const recenterMap = async () => {
      triggerHaptic();
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { showToast("Permission Denied", "error"); return; }
        let location = await Location.getCurrentPositionAsync({});
        if(mapRef.current) mapRef.current.animateToRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
      } catch (e) { showToast("Check GPS Settings", "error"); }
  };

  const toggleSheet = () => { triggerHaptic(); animateUI(); setIsExpanded(!isExpanded); };
  const closeSheet = () => { if(isExpanded) { triggerHaptic(); animateUI(); setIsExpanded(false); Keyboard.dismiss(); } };

  const searchLocations = async (query, field) => {
    if (!isExpanded) toggleSheet();
    if (field === 'pickup') setPickup(query); else setDropoff(query);
    setActiveField(field);
    if (query.length > 2) {
      try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=ng&limit=5`); const data = await response.json(); setSuggestions(data); } catch (e) {}
    } else setSuggestions([]);
  };

  const getRoute = async (startLat, startLng, endLat, endLng) => {
      try {
          const response = await fetch(`http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`);
          const json = await response.json();
          if(json.routes && json.routes.length > 0) {
              const points = decode(json.routes[0].geometry);
              setRouteCoords(points);
              return json.routes[0].distance / 1000;
          }
      } catch(e) { console.log(e); return 0; }
  };

  const selectLocation = async (item) => {
    triggerHaptic();
    const coords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
    if (activeField === 'pickup') { setPickup(item.display_name); setPickupCoords(coords); } else { setDropoff(item.display_name); setDropoffCoords(coords); }
    setSuggestions([]); setActiveField(null); Keyboard.dismiss();
    
    const pCoords = activeField === 'pickup' ? coords : pickupCoords; 
    const dCoords = activeField === 'dropoff' ? coords : dropoffCoords;
    
    if (pCoords && dCoords) {
      const distKm = await getRoute(pCoords.lat, pCoords.lon, dCoords.lat, dCoords.lon);
      setDistance(distKm || calculateDistance(pCoords.lat, pCoords.lon, dCoords.lat, dCoords.lon));
      
      let base = 500 + (250 * (distKm || 1));
      setPrice(Math.ceil(base / 100) * 100);
      
      if(mapRef.current) mapRef.current.fitToCoordinates([{latitude:pCoords.lat, longitude:pCoords.lon}, {latitude:dCoords.lat, longitude:dCoords.lon}], { edgePadding: {top: 50, right: 50, bottom: 350, left: 50}, animated: true });
    }
  };

  const handleRequest = async () => {
    triggerHaptic();
    if (!dropoffCoords || !pickupCoords) return showToast("Select valid locations", "error");
    setLoading(true); const pin = generatePIN();
    let finalPrice = price;
    if(vehicle === 'car') finalPrice = price * 1.5;
    if(vehicle === 'van') finalPrice = price * 2.5;

    await supabase.from('missions').insert({ pickup, pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lon, dropoff, dropoff_lat: dropoffCoords.lat, dropoff_lng: dropoffCoords.lon, distance_km: distance, price: `₦${finalPrice.toLocaleString()}`, status: 'pending', delivery_pin: pin });
    setPickup(''); setDropoff(''); setPickupCoords(null); setDropoffCoords(null); setRouteCoords([]); refreshOrders(); setLoading(false); setIsExpanded(false);
    showToast(`Order Placed! PIN: ${pin}`, "success");
  };

  return (
    <View style={{flex:1}}>
      <MapView ref={mapRef} onPress={closeSheet} style={styles.map} initialRegion={{ latitude: 4.8156, longitude: 7.0498, latitudeDelta: 0.1, longitudeDelta: 0.1 }} userInterfaceStyle="dark" showsUserLocation={true}>
         {pickupCoords && <Marker coordinate={{latitude: pickupCoords.lat, longitude: pickupCoords.lon}} pinColor={THEME.primary} />}
         {dropoffCoords && <Marker coordinate={{latitude: dropoffCoords.lat, longitude: dropoffCoords.lon}} pinColor={THEME.success} />}
         {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={THEME.primary} strokeWidth={4} />}
         {ghostDrivers.map(g => (
            <Marker key={g.id} coordinate={{latitude:g.lat, longitude:g.lng}}>
                <View style={{backgroundColor:THEME.cardBg, padding:5, borderRadius:10, borderWidth:1, borderColor:THEME.primary}}><Text style={{fontSize:15}}>🛵</Text></View>
            </Marker>
         ))} 
      </MapView>
      
      <SafeAreaView style={{position:'absolute', top:0, width:'100%', pointerEvents: 'box-none'}}>
         <View style={styles.glassHeader}>
            <Text style={styles.headerTitle}>H O S A</Text>
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtnPill}><Text style={styles.logoutText}>🛑 LOGOUT</Text></TouchableOpacity>
         </View>
      </SafeAreaView>

      <TouchableOpacity onPress={recenterMap} style={styles.fab}><Text style={{fontSize:22}}>🎯</Text></TouchableOpacity>
      
      {distance > 0 && routeCoords.length > 0 && (
          <View style={{position:'absolute', top:110, alignSelf:'center', backgroundColor:THEME.glass, paddingHorizontal:15, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:THEME.primary}}>
              <Text style={{color:'#FFF', fontWeight:'bold'}}>{distance.toFixed(1)} km • ~{Math.ceil(distance * 3)} mins</Text>
          </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottomPanelWrapper}>
         <View style={[styles.glassPanel, {marginBottom: 85}]}>
            <TouchableOpacity onPress={toggleSheet} style={{width:'100%', alignItems:'center', paddingBottom:15}}>
                {isExpanded ? <View style={{backgroundColor:'#333', borderRadius:20, paddingHorizontal:10, paddingVertical:2}}><Text style={{color:'#999', fontSize:12, fontWeight:'bold'}}>▼ CLOSE</Text></View> : <View style={{width:40, height:4, backgroundColor:'#444', borderRadius:2}} />}
            </TouchableOpacity>

            {!isExpanded ? (
                <TouchableOpacity onPress={toggleSheet} style={styles.inputGroup}><Text style={{marginRight:10, fontSize:18}}>🔍</Text><Text style={{color:'#999', fontSize:16}}>Where to?</Text></TouchableOpacity>
            ) : (
                <View>
                    <View style={{flexDirection:'row', gap:10, marginBottom:15}}>
                        <TouchableOpacity style={styles.shortcutBtn}><Text style={{color:'#FFF'}}>📦 Goods</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.shortcutBtn}><Text style={{color:'#FFF'}}>📄 Documents</Text></TouchableOpacity>
                    </View>
                    <View style={styles.inputGroup}><Text style={{marginRight:10}}>🟢</Text><TextInput style={styles.cleanInput} placeholder="Pickup Location..." placeholderTextColor="#666" value={pickup} onChangeText={(t)=>searchLocations(t,'pickup')} onFocus={()=>setActiveField('pickup')} /></View>
                    <View style={{height:10}} /><View style={styles.inputGroup}><Text style={{marginRight:10}}>🏁</Text><TextInput style={styles.cleanInput} placeholder="Dropoff Location..." placeholderTextColor="#666" value={dropoff} onChangeText={(t)=>searchLocations(t,'dropoff')} onFocus={()=>setActiveField('dropoff')} /></View>
                    
                    {suggestions.length > 0 && (
                        <View style={styles.inlineSuggestions}>
                            {suggestions.map((item, i) => (
                                <TouchableOpacity key={i} style={styles.suggestionRow} onPress={() => selectLocation(item)}>
                                    <Text style={{color:'#FFF'}}>{item.display_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <View style={{flexDirection:'row', justifyContent:'space-between', marginVertical:15}}>
                        <TouchableOpacity onPress={()=>setVehicle('bike')} style={[styles.vehicleCard, vehicle==='bike'&&styles.vehicleActive]}><Text style={{fontSize:20}}>🛵</Text><Text style={styles.vTitle}>Bike</Text><Text style={styles.vPrice}>₦{(price).toLocaleString()}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>setVehicle('car')} style={[styles.vehicleCard, vehicle==='car'&&styles.vehicleActive]}><Text style={{fontSize:20}}>🚗</Text><Text style={styles.vTitle}>Car</Text><Text style={styles.vPrice}>₦{(price*1.5).toLocaleString()}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>setVehicle('van')} style={[styles.vehicleCard, vehicle==='van'&&styles.vehicleActive]}><Text style={{fontSize:20}}>🚚</Text><Text style={styles.vTitle}>Van</Text><Text style={styles.vPrice}>₦{(price*2.5).toLocaleString()}</Text></TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity style={styles.actionBtn} onPress={handleRequest}><View><Text style={styles.actionBtnText}>{loading ? "PROCESSING..." : `CONFIRM DELIVERY`}</Text></View></TouchableOpacity>
                </View>
            )}
         </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// --- TAB 2: ORDERS ---
function OrdersScreen({ orders, refresh, showToast }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const shareTracking = async (order) => { try { await Share.share({ message: `Track delivery ${order.id}` }); } catch (error) { showToast(error.message, "error"); } };
  const cancelOrder = (id) => { triggerHaptic(); Alert.alert("Cancel Order?", "Confirm", [{text:"No"}, {text:"Yes", style:'destructive', onPress: async () => { await supabase.from('missions').delete().eq('id', id); refresh(); showToast("Cancelled", "success"); }}]); }
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Activity</Text>
      <FlatList 
        data={orders} 
        keyExtractor={item => item.id} 
        refreshControl={<RefreshControl onRefresh={refresh} tintColor={THEME.primary}/>} 
        ListEmptyComponent={
            <View style={{alignItems:'center', marginTop:50}}>
                <Text style={{fontSize:40}}>📭</Text>
                <Text style={{color:THEME.subtext, marginTop:10}}>No activity yet.</Text>
            </View>
        }
        renderItem={({ item }) => (
        <TouchableOpacity onPress={() => setSelectedOrder(item)} style={styles.historyCard}>
           <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{color:THEME.primary, fontWeight:'bold'}}>{item.price}</Text><Text style={{color: item.status==='completed'?THEME.success:THEME.subtext, fontSize:10, fontWeight:'bold'}}>{item.status.toUpperCase()}</Text></View>
           <Text style={{color:'#FFF', marginVertical:8, fontSize:16, fontWeight:'600'}} numberOfLines={1}>{item.dropoff}</Text>
           {item.status === 'pending' ? <Text style={{color:THEME.accent, fontSize:12, fontWeight:'bold'}}>Waiting for Rider...</Text> : <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{color:THEME.subtext, fontSize:12}}>Rider Assigned</Text>{item.profiles?.phone_number && <TouchableOpacity onPress={() => openWhatsApp(item.profiles.phone_number, `Order ${item.id}`)} style={{backgroundColor:THEME.success, paddingHorizontal:10, borderRadius:4}}><Text style={{color:'#000', fontSize:10}}>CHAT</Text></TouchableOpacity>}</View>}
        </TouchableOpacity>
      )} />
      <Modal visible={!!selectedOrder} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <Text style={styles.sectionHeader}>TRACKING</Text>
               <View style={{width:'100%', marginBottom:20}}><OrderTimeline status={selectedOrder?.status} /></View>
               <View style={{flexDirection:'row', gap:10, width:'100%', marginBottom:10}}>
                  <TouchableOpacity onPress={() => shareTracking(selectedOrder)} style={[styles.smallBtn, {backgroundColor:THEME.surface, flex:1}]}><Text style={{color:'#FFF'}}>SHARE LINK</Text></TouchableOpacity>
                  {selectedOrder?.status === 'pending' && <TouchableOpacity onPress={() => { cancelOrder(selectedOrder.id); setSelectedOrder(null); }} style={[styles.smallBtn, {backgroundColor:THEME.danger, flex:1}]}><Text style={{color:'#FFF'}}>CANCEL</Text></TouchableOpacity>}
               </View>
               <TouchableOpacity onPress={() => setSelectedOrder(null)} style={[styles.primaryBtn, {width:'100%', marginTop:0}]}><Text style={styles.btnText}>CLOSE</Text></TouchableOpacity>
            </View>
         </View>
      </Modal>
      <View style={{height: 80}} /> 
    </SafeAreaView>
  );
}

// --- TAB 3: ACCOUNT ---
function AccountScreen({ session, profile, refreshProfile, showToast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone_number || '');
  const [securityModal, setSecurityModal] = useState({visible:false, type:''});
  const [secureInput, setSecureInput] = useState('');

  const checkForUpdates = async () => {
      showToast("Checking for updates...", "info");
      try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); } 
          else { showToast("App is up to date", "success"); }
      } catch (error) { showToast("Update check failed", "error"); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) showToast("Image selected", "info");
  };
  const handleUpdate = async () => { triggerHaptic(); await supabase.from('profiles').update({ full_name: name, phone_number: phone }).eq('id', session.user.id); setEditing(false); refreshProfile(); showToast("Profile Updated", "success"); };
  
  const handleSecurityUpdate = async () => {
      triggerHaptic();
      try {
          if(securityModal.type === 'email') await supabase.auth.updateUser({ email: secureInput });
          if(securityModal.type === 'password') await supabase.auth.updateUser({ password: secureInput });
          showToast(`Request Sent. Check email if required.`, "success");
          setSecurityModal({visible:false, type:''}); setSecureInput('');
      } catch(e) { showToast(e.message, "error"); }
  };

  const shareApp = async () => { try { await Share.share({ message: "Download Hosa Logistics App: The future of delivery." }); } catch (e) {} };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Profile</Text>
      <View style={{alignItems: 'center', marginBottom: 30}}>
         <TouchableOpacity onPress={pickImage} style={styles.avatar}>{profile.avatar_url ? <Image source={{uri: profile.avatar_url}} style={{width:90, height:90, borderRadius:45}}/> : <Text style={{fontSize:30}}>📷</Text>}</TouchableOpacity>
         <Text style={{color:'#FFF', fontSize:22, fontWeight:'bold', marginTop:10}}>{profile.full_name || 'User'}</Text>
      </View>
      <View style={styles.settingsSection}><Text style={styles.sectionHeader}>PERSONAL INFO</Text>
         {editing ? (<><TextInput style={styles.settingInput} value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="#555" /><TextInput style={styles.settingInput} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#555" /><View style={{flexDirection:'row', gap:10}}><TouchableOpacity style={[styles.smallBtn, {backgroundColor:THEME.success, flex:1}]} onPress={handleUpdate}><Text style={{color:'#000', fontWeight:'bold'}}>SAVE</Text></TouchableOpacity><TouchableOpacity style={[styles.smallBtn, {backgroundColor:'#333', flex:1}]} onPress={() => setEditing(false)}><Text style={{color:'#FFF'}}>CANCEL</Text></TouchableOpacity></View></>) : (<><View style={styles.settingRow}><Text style={{color:THEME.subtext}}>Name</Text><Text style={{color:'#FFF'}}>{profile.full_name || 'Set Name'}</Text></View><View style={styles.settingRow}><Text style={{color:THEME.subtext}}>Phone</Text><Text style={{color:'#FFF'}}>{profile.phone_number || 'Set Phone'}</Text></View><TouchableOpacity style={styles.outlineBtn} onPress={() => { triggerHaptic(); setEditing(true); }}><Text style={{color:THEME.primary, fontWeight:'bold'}}>EDIT DETAILS</Text></TouchableOpacity></>)}
      </View>
      <View style={styles.settingsSection}><Text style={styles.sectionHeader}>SECURITY</Text>
         <TouchableOpacity onPress={()=>setSecurityModal({visible:true, type:'email'})} style={styles.settingRow}><Text style={{color:'#FFF'}}>📧 Change Email</Text><Text style={{color:THEME.subtext}}>→</Text></TouchableOpacity>
         <TouchableOpacity onPress={()=>setSecurityModal({visible:true, type:'password'})} style={styles.settingRow}><Text style={{color:'#FFF'}}>🔒 Change Password</Text><Text style={{color:THEME.subtext}}>→</Text></TouchableOpacity>
      </View>
      <View style={styles.settingsSection}><Text style={styles.sectionHeader}>APP SETTINGS</Text>
         <TouchableOpacity onPress={checkForUpdates} style={styles.settingRow}><Text style={{color:'#FFF'}}>🔄 Check for Updates</Text><Text style={{color:THEME.success}}>v28.0</Text></TouchableOpacity>
         <TouchableOpacity onPress={shareApp} style={styles.settingRow}><Text style={{color:'#FFF'}}>📢 Share App</Text><Text style={{color:THEME.subtext}}>→</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={() => { triggerHaptic(); supabase.auth.signOut(); }}><Text style={{color:THEME.danger, fontWeight:'bold', fontSize:16}}>LOGOUT</Text></TouchableOpacity>
      
      <Modal visible={securityModal.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.sectionHeader}>CHANGE {securityModal.type.toUpperCase()}</Text>
                  <TextInput style={[styles.settingInput, {width:'100%'}]} placeholder={`New ${securityModal.type}`} placeholderTextColor="#555" value={secureInput} onChangeText={setSecureInput} secureTextEntry={securityModal.type === 'password'} autoCapitalize="none" />
                  <TouchableOpacity onPress={handleSecurityUpdate} style={[styles.primaryBtn, {width:'100%'}]}><Text style={styles.btnText}>UPDATE</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>setSecurityModal({visible:false, type:''})} style={{marginTop:15}}><Text style={{color:THEME.danger}}>Cancel</Text></TouchableOpacity>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

// ================== RIDER APP ==================
function RiderApp({ session, showToast }) {
  const [currentTab, setCurrentTab] = useState('jobs');
  const [missions, setMissions] = useState([]);
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [graphData, setGraphData] = useState([0,0,0,0,0,0,0]);
  const [stats, setStats] = useState({count:0, rating:5.0});
  const [myLocation, setMyLocation] = useState(null);
  const mapRef = useRef(null);

  // Load Persistence & Location
  useEffect(() => {
    (async () => { 
        try {
            let { status } = await Location.requestForegroundPermissionsAsync(); 
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setMyLocation(loc.coords);
                if(mapRef.current) mapRef.current.animateToRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
            }
            const savedStatus = await AsyncStorage.getItem('driver_online');
            if(savedStatus === 'true') setOnline(true);
        } catch(e) { console.log(e); }
    })();
  }, []);

  const toggleOnline = async () => {
      const newVal = !online;
      triggerHaptic(); setOnline(newVal); animateUI();
      // UPDATE SUPABASE FOR ADMIN VISIBILITY
      await supabase.from('profiles').update({ is_online: newVal }).eq('id', session.user.id);
      await AsyncStorage.setItem('driver_online', newVal.toString());
      if(newVal) showToast("You are now ONLINE", "success");
      else showToast("You are now OFFLINE", "info");
  };

  useEffect(() => {
    const fetch = async () => { 
      if(online) { 
          const {data} = await supabase.from('missions').select('*').neq('status','completed'); 
          if(data) setMissions(data); 
      } else {
          setMissions([]); // Clear job list if offline
      }
      
      // FETCH REAL EARNINGS (Always works, even offline)
      const { data: myJobs } = await supabase.from('missions').select('*').eq('driver_id', session.user.id).eq('status', 'completed');
      if(myJobs) { 
          const totalEarned = myJobs.reduce((acc, c) => acc + (parseInt(c.price.replace(/\D/g,''))||0), 0);
          setEarnings(totalEarned);
          // Calculate rating avg (default 5 if none)
          const avgRating = myJobs.length > 0 ? (myJobs.reduce((acc, c) => acc + (c.rating || 5), 0) / myJobs.length) : 5.0;
          setStats({ count: myJobs.length, rating: avgRating }); 

          // WEEKLY GRAPH LOGIC
          let weekly = [0,0,0,0,0,0,0];
          myJobs.forEach(job => {
              const day = new Date(job.created_at).getDay(); 
              const amt = parseInt(job.price.replace(/\D/g,'')) || 0;
              const index = day === 0 ? 6 : day - 1; 
              if(index >= 0 && index < 7) weekly[index] += amt;
          });
          setGraphData(weekly);
      }
    };
    fetch(); const i = setInterval(fetch, 5000); return () => clearInterval(i);
  }, [online]);

  const updateStatus = async (id, status) => { triggerHaptic(); await supabase.from('missions').update({status, driver_id:session.user.id}).eq('id',id); showToast(`Status: ${status}`, "success"); };

  return (
    <View style={styles.container}>
      {/* RIDER MAP BACKGROUND */}
      <MapView ref={mapRef} style={[styles.map, {opacity: online ? 1 : 0.4}]} initialRegion={{ latitude: 4.8156, longitude: 7.0498, latitudeDelta: 0.1, longitudeDelta: 0.1 }} userInterfaceStyle="dark" showsUserLocation={true}>
         {/* Only show other missions if online */}
         {online && missions.map(m => (m.pickup_lat && <Marker key={m.id} coordinate={{latitude: m.pickup_lat, longitude: m.pickup_lng}} pinColor={m.status === 'pending' ? 'orange' : THEME.primary} />))}
      </MapView>

      {/* OVERLAY FOR OFFLINE STATE */}
      {!online && (
          <View style={styles.offlineOverlay}>
              <Text style={{fontSize: 50}}>🛵</Text>
              <Text style={{color: '#FFF', fontWeight:'bold', fontSize: 18, marginTop: 10}}>YOU ARE OFFLINE</Text>
              <Text style={{color: '#888', marginTop: 5}}>Go online to start receiving orders.</Text>
          </View>
      )}

      <SafeAreaView style={{position:'absolute', top:0, width:'100%', pointerEvents: 'box-none'}}>
         <View style={styles.glassHeader}>
            <View>
               <Text style={styles.headerTitle}>RIDER</Text>
               <Text style={{color: online ? THEME.success : '#AAA', fontSize: 10, fontWeight: 'bold'}}>{online ? '● SCANNING FOR DELIVERIES...' : '● OFFLINE'}</Text>
            </View>
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtnPill}><Text style={styles.logoutText}>🛑 LOGOUT</Text></TouchableOpacity>
         </View>
      </SafeAreaView>

      <SafeAreaView pointerEvents="box-none" style={{flex: 1, justifyContent: 'flex-end', marginBottom: 90}}>
         {!online ? (
             <View style={{alignItems:'center'}}>
                 <TouchableOpacity onPress={toggleOnline} style={[styles.actionBtn, {width: '80%', height: 70, backgroundColor: THEME.primary, shadowColor:THEME.primary, shadowOpacity:0.6, shadowRadius:20}]}>
                     <Text style={{color:'#000', fontSize: 20, fontWeight:'900'}}>GO ONLINE</Text>
                 </TouchableOpacity>
             </View>
         ) : (
             <View style={{height: '55%'}}>
                 <View style={{alignItems:'center', marginBottom:10}}>
                     <TouchableOpacity onPress={toggleOnline} style={{backgroundColor:THEME.danger, paddingHorizontal:20, paddingVertical:8, borderRadius:20}}><Text style={{color:'#FFF', fontWeight:'bold', fontSize:12}}>GO OFFLINE</Text></TouchableOpacity>
                 </View>

                 {currentTab === 'jobs' ? (
                    missions.length === 0 ? 
                    <View style={styles.glassPanel}><ActivityIndicator size="large" color={THEME.primary}/><Text style={{color:THEME.subtext, marginTop:15, textAlign:'center'}}>Scanning for deliveries...</Text></View> 
                    : 
                    <FlatList data={missions} keyExtractor={i=>i.id} renderItem={({item}) => (
                      <View style={styles.historyCard}>
                         <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{color:THEME.success, fontSize:12, fontWeight:'bold'}}>NEW REQUEST</Text><Text style={{color:THEME.primary, fontWeight:'bold', fontSize:18}}>{item.price}</Text></View>
                         <Text style={{color:'#FFF', marginVertical:5, fontSize:16, fontWeight:'bold'}}>To: {item.dropoff}</Text>
                         <Text style={{color:'#999', fontSize:12}}>From: {item.pickup}</Text>
                         <View style={{flexDirection:'row', gap:10, marginTop:15}}>
                            {item.status === 'pending' && <TouchableOpacity onPress={()=>updateStatus(item.id, 'in_progress')} style={[styles.primaryBtn, {padding:15, marginTop:0, flex:1}]}><Text style={styles.btnText}>ACCEPT DELIVERY</Text></TouchableOpacity>}
                            {item.status === 'in_progress' && <TouchableOpacity onPress={()=>updateStatus(item.id, 'arrived')} style={[styles.primaryBtn, {padding:15, marginTop:0, flex:1, backgroundColor:THEME.accent}]}><Text style={styles.btnText}>I'M HERE</Text></TouchableOpacity>}
                            {item.status === 'arrived' && <TouchableOpacity onPress={()=>updateStatus(item.id, 'completed')} style={[styles.primaryBtn, {padding:15, marginTop:0, flex:1, backgroundColor:THEME.success}]}><Text style={styles.btnText}>COMPLETE</Text></TouchableOpacity>}
                            <TouchableOpacity onPress={()=>openGoogleMaps(item.pickup_lat, item.pickup_lng, "Pickup")} style={[styles.smallBtn, {backgroundColor:'#333', width:50}]}><Text style={{fontSize:20}}>🗺️</Text></TouchableOpacity>
                         </View>
                      </View>
                    )} />
                 ) : (
                    <View style={[styles.glassPanel, {margin: 20}]}>
                       <Text style={styles.pageTitle}>Earnings</Text>
                       <View style={{flexDirection:'row', gap:10, marginBottom:20}}>
                           <StatBadge icon="⭐" label="Rating" value={stats.rating.toFixed(1)} color="#F59E0B" />
                           <StatBadge icon="✅" label="Acceptance" value="100%" color={THEME.success} />
                           <StatBadge icon="📦" label="Deliveries" value={stats.count} color={THEME.primary} />
                       </View>
                       <View style={styles.statCard}><Text style={{color:THEME.subtext}}>TOTAL EARNED</Text><Text style={{color:THEME.success, fontSize:40, fontWeight:'bold'}}>₦{earnings.toLocaleString()}</Text></View>
                       <Text style={[styles.sectionHeader, {marginTop:20}]}>WEEKLY PERFORMANCE</Text>
                       <EarningsGraph data={graphData} />
                    </View>
                 )}
             </View>
         )}
      </SafeAreaView>

      <View style={styles.tabBarContainer}><View style={styles.tabBar}><TouchableOpacity onPress={() => setCurrentTab('jobs')} style={styles.tabBtn}><Text style={{fontSize: 22, opacity: currentTab==='jobs'?1:0.4}}>🛵</Text></TouchableOpacity><TouchableOpacity onPress={() => setCurrentTab('earnings')} style={styles.tabBtn}><Text style={{fontSize: 22, opacity: currentTab==='earnings'?1:0.4}}>💰</Text></TouchableOpacity></View></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.darkBg },
  map: { ...StyleSheet.absoluteFillObject },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 0 },
  loadingScreen: { flex: 1, backgroundColor: THEME.darkBg, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  headerSub: { color: THEME.success, fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
  iconBtn: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  logoutBtnPill: { backgroundColor: 'rgba(255, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: THEME.danger },
  logoutText: { color: THEME.danger, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  logoutBtnSmall: { backgroundColor: 'rgba(255, 68, 68, 0.1)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: THEME.danger },
  logoutTextSmall: { color: THEME.danger, fontSize: 10, fontWeight: '900' },
  headerLogoutBtn: { backgroundColor: 'rgba(255, 68, 68, 0.2)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: THEME.danger },
  headerLogoutText: { color: THEME.danger, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  fab: { position: 'absolute', top: 120, right: 20, backgroundColor: THEME.cardBg, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, borderWidth: 1, borderColor: '#333' },
  pageTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', padding: 20, letterSpacing: -1 },
  glassHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: THEME.glass, margin: 10, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  headerAvatar: { width: 30, height: 30, borderRadius: 15 },
  headerAvatarPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#333', justifyContent:'center', alignItems:'center' },
  tabBarContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: THEME.glass, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 40, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, gap: 40 },
  tabBtn: { alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 4, height: 4, backgroundColor: THEME.primary, borderRadius: 2, marginTop: 4 },
  bottomPanelWrapper: { flex: 1, justifyContent: 'flex-end' },
  glassPanel: { backgroundColor: THEME.cardBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  inputGroup: { flexDirection: 'row', backgroundColor: '#202022', padding: 16, borderRadius: 16, alignItems: 'center' },
  cleanInput: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500' },
  suggestionOverlay: { position: 'absolute', bottom: 90, left: 20, right: 20, backgroundColor: '#202022', borderRadius: 16, padding: 10, zIndex: 100, borderWidth: 1, borderColor: '#333' },
  inlineSuggestions: { backgroundColor:'#202022', borderRadius:16, marginTop:5, marginBottom:15, borderWidth:1, borderColor:'#333' },
  suggestionRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#333' },
  actionBtn: { backgroundColor: THEME.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  actionBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  primaryBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#000', fontWeight: 'bold' },
  smallBtn: { padding: 10, borderRadius: 8, alignItems: 'center' },
  outlineBtn: { borderWidth: 1, borderColor: THEME.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  logoutBtn: { margin: 20, alignItems: 'center', padding: 15, backgroundColor: '#1A1A1C', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  bioBtn: { alignItems:'center', marginTop: 20, backgroundColor: '#222', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  authContainer: { flex: 1, backgroundColor: THEME.darkBg, justifyContent: 'center', padding: 20 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoBadge: { width: 80, height: 80, backgroundColor: '#1A1A1C', borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  logoText: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: 4 },
  logoSub: { color: THEME.primary, letterSpacing: 6, fontWeight: 'bold', fontSize: 12 },
  authCard: { backgroundColor: THEME.cardBg, padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#222' },
  welcomeText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', letterSpacing: 2 },
  input: { backgroundColor: '#202022', color: '#FFF', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2D' },
  linkText: { color: THEME.subtext, textAlign: 'center', marginTop: 20 },
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  kpiCard: { flex: 1, backgroundColor: THEME.glass, margin: 5, padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  kpiLabel: { color: '#888', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  kpiValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  bottomSheet: { backgroundColor: THEME.darkBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '40%', borderWidth: 1, borderColor: '#333' },
  adminListRow: { flexDirection: 'row', backgroundColor: '#1A1A1C', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  statCard: { flex: 1, backgroundColor: THEME.cardBg, padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  historyCard: { backgroundColor: THEME.cardBg, marginHorizontal: 20, marginBottom: 12, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#222' },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#202022', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  settingsSection: { backgroundColor: '#18181B', marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  sectionHeader: { color: THEME.subtext, fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  settingInput: { backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: THEME.cardBg, padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#333', alignItems:'center', width:'100%' },
  timelineContainer: { marginVertical: 10 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', borderWidth: 2, borderColor: '#333' },
  line: { width: 2, height: 30, backgroundColor: '#333', marginVertical: 2 },
  timelineText: { color: '#666', fontSize: 14, marginLeft: 10, top: -4 },
  graphContainer: { flexDirection: 'row', height: 150, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 10 },
  barWrapper: { alignItems: 'center', flex: 1 },
  bar: { width: 8, borderRadius: 4 },
  barLabel: { color: '#666', fontSize: 10, marginTop: 5 },
  shortcutBtn: { backgroundColor:'#202022', paddingHorizontal:12, paddingVertical:8, borderRadius:12, borderWidth:1, borderColor:'#333', flexDirection:'row', alignItems:'center' },
  vehicleCard: { flex:1, backgroundColor:'#202022', marginHorizontal:5, padding:10, borderRadius:12, borderWidth:1, borderColor:'#333', alignItems:'center' },
  vehicleActive: { borderColor: THEME.primary, backgroundColor:'rgba(255,107,0,0.1)' },
  vTitle: { color:'#FFF', fontWeight:'bold', marginTop:5 },
  vPrice: { color:THEME.subtext, fontSize:10 },
  toastContainer: { position: 'absolute', top: 50, left: 20, right: 20, padding: 15, borderRadius: 12, zIndex: 9999, alignItems: 'center', shadowColor:'#000', shadowOpacity:0.5, shadowRadius:10 },
  toastText: { color: '#FFF', fontWeight: 'bold' },
  statBadge: { flex:1, alignItems:'center', padding:10, borderRadius:12, borderWidth:1, backgroundColor:'#222' },
  
  // FIXED TAB HEADER FOR ADMIN
  tabHeader: { paddingVertical:10, paddingHorizontal:20, marginRight:10 },
  activeTabHeader: { borderBottomWidth:2, borderBottomColor:THEME.primary }
});