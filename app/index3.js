import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Linking, Platform, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../supabase';

// === THEME CONFIGURATION (TITANIUM 2025) ===
const THEME = {
  primary: '#FF6B00', // Brand Orange
  darkBg: '#000000', // True Black
  glass: 'rgba(15, 15, 20, 0.85)', // Frosted Glass
  text: '#FFFFFF',
  subtext: '#71717A',
  success: '#00E676', 
  danger: '#FF1744',
  warning: '#F59E0B',
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

// === CUSTOM MAP STYLE (CYBERPUNK MODE) ===
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

// === UTILITIES ===
const generatePIN = () => Math.floor(1000 + Math.random() * 9000).toString();
const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180)) * Math.cos(lat2*(Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return parseFloat((R * c).toFixed(1));
};

// === MAIN APP ===
export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data && data.role) setUserRole(data.role);
    } catch (e) { console.log(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id); else setLoading(false);
    });
    
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRole(session.user.id); else { setUserRole(null); setLoading(false); }
    });
  }, []);

  if (loading) return <View style={styles.loadingScreen}><ActivityIndicator size="large" color={THEME.primary}/></View>;
  if (!session) return <AuthScreen />;
  if (userRole === 'admin') return <AdminDashboard />;
  if (userRole === 'driver') return <DriverApp session={session} />;
  return <CustomerApp session={session} />;
}

// ================== 1. AUTH SCREEN ==================
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleAuth = async () => {
    triggerHaptic();
    if(!email || !password) return Alert.alert("Required", "Please fill all fields");
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id, email, role: 'customer', full_name: fullName, phone_number: phone, payment_method: 'Cash'
          });
        }
      }
    } catch (e) { Alert.alert("Error", e.message); } 
    finally { setLoading(false); }
  };

  const handleBiometricLogin = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Login to Hosa Logistics' });
    if (result.success) Alert.alert("Biometrics Verified", "Logging you in...");
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
        {isLogin && ( <TouchableOpacity onPress={handleBiometricLogin} style={styles.bioBtn}><Text style={{fontSize:24}}>👤</Text></TouchableOpacity> )}
        <TouchableOpacity onPress={() => { triggerHaptic(); setIsLogin(!isLogin); }}><Text style={styles.linkText}>{isLogin ? "Create Account" : "Back to Login"}</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ================== 2. ADMIN DASHBOARD (GOD MODE) ==================
function AdminDashboard() {
  const [missions, setMissions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, active: 0, pending: 0 });

  const fetchData = async () => {
    // 1. Get Missions
    const { data: mData } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
    if(mData) {
      setMissions(mData);
      const rev = mData.filter(m => m.status === 'completed').reduce((acc, curr) => acc + (parseInt(curr.price.replace(/\D/g, '')) || 0), 0);
      setStats({ revenue: rev, active: mData.filter(m => m.status === 'in_progress').length, pending: mData.filter(m => m.status === 'pending').length });
    }
    // 2. Get Drivers
    const { data: dData } = await supabase.from('profiles').select('*').eq('role', 'driver');
    if(dData) setDrivers(dData);
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); }, []);

  return (
    <View style={styles.container}>
      {/* 1. MAP BACKGROUND */}
      <MapView style={styles.map} initialRegion={{ latitude: 4.8156, longitude: 7.0498, latitudeDelta: 0.15, longitudeDelta: 0.15 }} customMapStyle={DARK_MAP_STYLE} provider={PROVIDER_DEFAULT}>
        {missions.map(m => (m.pickup_lat && <Marker key={m.id} coordinate={{latitude: m.pickup_lat, longitude: m.pickup_lng}} pinColor={m.status === 'pending' ? 'orange' : m.status === 'in_progress' ? '#00FF00' : '#444'} />))}
      </MapView>
      
      {/* 2. HUD OVERLAY */}
      <SafeAreaView pointerEvents="box-none" style={{flex: 1}}>
        {/* Header */}
        <View style={styles.glassHeader}>
           <View>
              <Text style={styles.headerTitle}>COMMAND CENTER</Text>
              <Text style={styles.headerSub}>SYSTEM ONLINE • PORT HARCOURT</Text>
           </View>
           <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.iconBtn}>
              <Text style={{color: THEME.danger, fontWeight: '900', fontSize: 10}}>PWR OFF</Text>
           </TouchableOpacity>
        </View>

        {/* Floating KPI Cards */}
        <View style={styles.kpiContainer}>
           <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>REVENUE</Text>
              <Text style={styles.kpiValue}>₦{stats.revenue.toLocaleString()}</Text>
           </View>
           <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>ACTIVE</Text>
              <Text style={[styles.kpiValue, {color: THEME.success}]}>{stats.active}</Text>
           </View>
           <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>FLEET</Text>
              <Text style={[styles.kpiValue, {color: THEME.primary}]}>{drivers.length}</Text>
           </View>
        </View>

        {/* Bottom Feed Panel */}
        <View style={styles.bottomSheet}>
           <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15, alignItems:'center'}}>
              <Text style={styles.sectionTitle}>LIVE FEED</Text>
              <View style={{flexDirection:'row', gap:5}}>
                 <View style={{width:8, height:8, borderRadius:4, backgroundColor:'orange'}}/><Text style={{color:'#666', fontSize:10}}>PENDING</Text>
                 <View style={{width:8, height:8, borderRadius:4, backgroundColor:THEME.success, marginLeft:10}}/><Text style={{color:'#666', fontSize:10}}>ACTIVE</Text>
              </View>
           </View>
           
           <FlatList data={missions} keyExtractor={item => item.id} renderItem={({ item }) => (
             <View style={styles.adminListRow}>
                <View style={{flex:1}}>
                   <Text style={{color:'#FFF', fontWeight:'bold', fontSize:14}} numberOfLines={1}>{item.dropoff}</Text>
                   <Text style={{color:'#666', fontSize:10}} numberOfLines={1}>{item.pickup}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                   <Text style={{color: THEME.primary, fontWeight:'bold'}}>{item.price}</Text>
                   <Text style={{color: item.status==='completed'?'#444':item.status==='in_progress'?THEME.success:'orange', fontSize:9, fontWeight:'900'}}>{item.status.toUpperCase()}</Text>
                </View>
             </View>
           )}/>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ================== 3. CUSTOMER APP ==================
function CustomerApp({ session }) {
  const [currentTab, setCurrentTab] = useState('home');
  const [profile, setProfile] = useState({});
  const [myOrders, setMyOrders] = useState([]);

  useEffect(() => { fetchProfile(); fetchOrders(); }, []);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if(data) setProfile(data);
  }
  const fetchOrders = async () => {
    const { data } = await supabase.from('missions').select('*, profiles:driver_id(full_name)').order('created_at', { ascending: false });
    setMyOrders(data || []);
  };
  const switchTab = (tab) => { triggerHaptic(); setCurrentTab(tab); };

  return (
    <View style={styles.container}>
      <View style={{flex: 1}}>
        {currentTab === 'home' && <HomeScreen session={session} profile={profile} refreshOrders={fetchOrders} />}
        {currentTab === 'orders' && <OrdersScreen orders={myOrders} refresh={fetchOrders} />}
        {currentTab === 'account' && <AccountScreen session={session} profile={profile} refreshProfile={fetchProfile} />}
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

// ... (HomeScreen, OrdersScreen, AccountScreen, DriverApp components remain functionally similar but use new THEME)

function HomeScreen({ session, profile, refreshOrders }) {
  const mapRef = useRef(null);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoff, setDropoff] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [distance, setDistance] = useState(0);
  const [price, setPrice] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = async () => {
    triggerHaptic();
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    let location = await Location.getCurrentPositionAsync({});
    if(mapRef.current) mapRef.current.animateToRegion({ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    let address = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    if(address[0]) { setPickup(`${address[0].street}, ${address[0].city}`); setPickupCoords({ lat: location.coords.latitude, lon: location.coords.longitude }); }
  };
  const searchLocations = async (query, field) => {
    if (field === 'pickup') setPickup(query); else setDropoff(query);
    setActiveField(field);
    if (query.length > 2) {
      try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=ng&limit=5`); const data = await response.json(); setSuggestions(data); } catch (e) {}
    } else setSuggestions([]);
  };
  const selectLocation = (item) => {
    triggerHaptic();
    const coords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
    if (activeField === 'pickup') { setPickup(item.display_name); setPickupCoords(coords); } else { setDropoff(item.display_name); setDropoffCoords(coords); }
    setSuggestions([]); setActiveField(null); Keyboard.dismiss();
    const pCoords = activeField === 'pickup' ? coords : pickupCoords; const dCoords = activeField === 'dropoff' ? coords : dropoffCoords;
    if (pCoords && dCoords) {
      const dist = calculateDistance(pCoords.lat, pCoords.lon, dCoords.lat, dCoords.lon); setDistance(dist); setPrice(Math.ceil((500 + (250 * dist)) / 100) * 100);
      if(mapRef.current) mapRef.current.fitToCoordinates([{latitude:pCoords.lat, longitude:pCoords.lon}, {latitude:dCoords.lat, longitude:dCoords.lon}], { edgePadding: {top: 50, right: 50, bottom: 350, left: 50}, animated: true });
    }
  };
  const handleRequest = async () => {
    triggerHaptic();
    if (!dropoffCoords || !pickupCoords) return Alert.alert("Error", "Select valid locations");
    setLoading(true); const pin = generatePIN();
    await supabase.from('missions').insert({ pickup, pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lon, dropoff, dropoff_lat: dropoffCoords.lat, dropoff_lng: dropoffCoords.lon, distance_km: distance, price: `₦${price.toLocaleString()}`, status: 'pending', delivery_pin: pin });
    setPickup(''); setDropoff(''); setPickupCoords(null); setDropoffCoords(null); refreshOrders(); setLoading(false);
    Alert.alert("Success", `Looking for riders! PIN: ${pin}`);
  };

  return (
    <View style={{flex:1}}>
      <MapView ref={mapRef} style={styles.map} initialRegion={{ latitude: 4.8156, longitude: 7.0498, latitudeDelta: 0.1, longitudeDelta: 0.1 }} userInterfaceStyle="dark" showsUserLocation={true}>
         {pickupCoords && <Marker coordinate={{latitude: pickupCoords.lat, longitude: pickupCoords.lon}} pinColor={THEME.primary} />}
         {dropoffCoords && <Marker coordinate={{latitude: dropoffCoords.lat, longitude: dropoffCoords.lon}} pinColor={THEME.success} />}
         {pickupCoords && dropoffCoords && <Polyline coordinates={[{latitude: pickupCoords.lat, longitude: pickupCoords.lon}, {latitude: dropoffCoords.lat, longitude: dropoffCoords.lon}]} strokeColor={THEME.primary} strokeWidth={4} />}
      </MapView>
      <SafeAreaView style={{position:'absolute', top:0, width:'100%'}}>
         <View style={styles.glassHeader}><View><Text style={styles.headerTitle}>Hi, {profile.full_name?.split(' ')[0]}</Text><Text style={{color:THEME.success, fontSize:10, fontWeight:'bold'}}>● ONLINE</Text></View><View style={{backgroundColor:'#222', paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:'#333'}}><Text style={{fontWeight:'bold', fontSize:12, color:'#FFF'}}>BALANCE: ₦0.00</Text></View></View>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottomPanelWrapper}>
         <View style={[styles.glassPanel, {marginBottom: 85}]}>
            <View style={styles.inputGroup}><Text style={{marginRight:10}}>🟢</Text><TextInput style={styles.cleanInput} placeholder="From..." placeholderTextColor="#666" value={pickup} onChangeText={(t)=>searchLocations(t,'pickup')} onFocus={()=>setActiveField('pickup')} /><TouchableOpacity onPress={getCurrentLocation} style={{padding:5}}><Text style={{fontSize:20}}>🎯</Text></TouchableOpacity></View><View style={{height:10}} /><View style={styles.inputGroup}><Text style={{marginRight:10}}>🏁</Text><TextInput style={styles.cleanInput} placeholder="To..." placeholderTextColor="#666" value={dropoff} onChangeText={(t)=>searchLocations(t,'dropoff')} onFocus={()=>setActiveField('dropoff')} /></View>
            {suggestions.length > 0 && (<View style={styles.suggestionOverlay}>{suggestions.map((item, i) => (<TouchableOpacity key={i} style={styles.suggestionRow} onPress={() => selectLocation(item)}><Text style={{color:'#FFF'}}>{item.display_name}</Text></TouchableOpacity>))}</View>)}
            <TouchableOpacity style={styles.actionBtn} onPress={handleRequest}><Text style={styles.actionBtnText}>{loading ? "PROCESSING..." : `REQUEST RIDE • ₦${price.toLocaleString()}`}</Text></TouchableOpacity>
         </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function OrdersScreen({ orders, refresh }) {
  const cancelOrder = (id) => { triggerHaptic(); Alert.alert("Cancel?", "This cannot be undone.", [{text:"Back"}, {text:"Confirm", style:'destructive', onPress: async () => { await supabase.from('missions').delete().eq('id', id); refresh(); }}]); }
  const handleSOS = () => { triggerHaptic(); Alert.alert("EMERGENCY", "Calling Security Services...", [{text:"CANCEL", style:'cancel'}, {text:"CALL 112", style:'destructive', onPress:()=>Linking.openURL('tel:112')}]); };
  return (
    <SafeAreaView style={styles.container}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20}}><Text style={styles.pageTitle}>Activity</Text><TouchableOpacity onPress={handleSOS} style={{backgroundColor:THEME.danger, paddingHorizontal:12, paddingVertical:6, borderRadius:20}}><Text style={{color:'#FFF', fontWeight:'bold'}}>SOS 🚨</Text></TouchableOpacity></View>
      <FlatList data={orders} keyExtractor={item => item.id} refreshControl={<RefreshControl onRefresh={refresh} tintColor={THEME.primary}/>} renderItem={({ item }) => (
        <View style={styles.historyCard}>
           <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={{color:THEME.primary, fontWeight:'bold'}}>{item.price}</Text><Text style={{color: item.status==='completed'?THEME.success:THEME.subtext, fontSize:10, fontWeight:'bold'}}>{item.status.toUpperCase()}</Text></View>
           <Text style={{color:'#FFF', marginVertical:8, fontSize:16, fontWeight:'600'}}>{item.dropoff}</Text><View style={{height:1, backgroundColor:'#333', marginVertical:5}}/>
           {item.status === 'pending' ? (<View style={{flexDirection:'row', justifyContent:'space-between', marginTop:5, alignItems:'center'}}><Text style={{color:'#FFF', fontSize:12}}>PIN: <Text style={{fontWeight:'bold', color:THEME.primary, fontSize:16}}>{item.delivery_pin}</Text></Text><TouchableOpacity onPress={() => cancelOrder(item.id)}><Text style={{color:THEME.danger, fontSize:12}}>Cancel</Text></TouchableOpacity></View>) : (<View style={{marginTop:5}}><Text style={{color:THEME.subtext, fontSize:12}}>Driver: {item.profiles?.full_name || 'Assigned'}</Text></View>)}
        </View>
      )} /><View style={{height: 80}} /> 
    </SafeAreaView>
  );
}

function AccountScreen({ session, profile, refreshProfile }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone_number || '');
  const handleUpdate = async () => { triggerHaptic(); await supabase.from('profiles').update({ full_name: name, phone_number: phone }).eq('id', session.user.id); setEditing(false); refreshProfile(); Alert.alert("Updated", "Profile saved successfully."); };
  const contactSupport = () => Linking.openURL('mailto:support@hosa.com?subject=Help Request');
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Profile</Text>
      <View style={{alignItems: 'center', marginBottom: 30}}><View style={styles.avatar}><Text style={{fontSize:30}}>👤</Text></View><Text style={{color:'#FFF', fontSize:22, fontWeight:'bold', marginTop:10}}>{profile.full_name || 'User'}</Text><Text style={{color:THEME.subtext}}>{session.user.email}</Text></View>
      <View style={styles.settingsSection}><Text style={styles.sectionHeader}>PERSONAL INFO</Text>
         {editing ? (<><TextInput style={styles.settingInput} value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="#555" /><TextInput style={styles.settingInput} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#555" /><View style={{flexDirection:'row', gap:10}}><TouchableOpacity style={[styles.smallBtn, {backgroundColor:THEME.success, flex:1}]} onPress={handleUpdate}><Text style={{color:'#000', fontWeight:'bold'}}>SAVE</Text></TouchableOpacity><TouchableOpacity style={[styles.smallBtn, {backgroundColor:'#333', flex:1}]} onPress={() => setEditing(false)}><Text style={{color:'#FFF'}}>CANCEL</Text></TouchableOpacity></View></>) : (<><View style={styles.settingRow}><Text style={{color:THEME.subtext}}>Name</Text><Text style={{color:'#FFF'}}>{profile.full_name || 'Set Name'}</Text></View><View style={styles.settingRow}><Text style={{color:THEME.subtext}}>Phone</Text><Text style={{color:'#FFF'}}>{profile.phone_number || 'Set Phone'}</Text></View><TouchableOpacity style={styles.outlineBtn} onPress={() => { triggerHaptic(); setEditing(true); }}><Text style={{color:THEME.primary, fontWeight:'bold'}}>EDIT DETAILS</Text></TouchableOpacity></>)}
      </View>
      <View style={styles.settingsSection}><Text style={styles.sectionHeader}>SUPPORT & SECURITY</Text><TouchableOpacity style={styles.settingRow} onPress={contactSupport}><Text style={{color:'#FFF'}}>Contact Support</Text><Text style={{fontSize:16}}>💬</Text></TouchableOpacity><TouchableOpacity style={styles.settingRow} onPress={() => supabase.auth.resetPasswordForEmail(session.user.email)}><Text style={{color:'#FFF'}}>Reset Password</Text><Text style={{color:THEME.subtext}}>→</Text></TouchableOpacity></View>
      <TouchableOpacity style={styles.logoutBtn} onPress={() => { triggerHaptic(); supabase.auth.signOut(); }}><Text style={{color:THEME.danger, fontWeight:'bold', fontSize:16}}>LOG OUT</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

function DriverApp({ session }) {
  const [missions, setMissions] = useState([]);
  const [online, setOnline] = useState(true);
  useEffect(() => { const fetch = async () => { if(online) { const {data} = await supabase.from('missions').select('*').eq('status','pending'); if(data) setMissions(data); } else setMissions([]); }; fetch(); const i = setInterval(fetch, 5000); return () => clearInterval(i); }, [online]);
  const accept = async (id) => { triggerHaptic(); await supabase.from('missions').update({status:'in_progress', driver_id:session.user.id}).eq('id',id); Alert.alert("Accepted","Go to pickup!"); };
  return (
    <SafeAreaView style={styles.container}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center'}}><Text style={styles.headerTitle}>DRIVER</Text><Switch value={online} onValueChange={(v)=>{triggerHaptic(); setOnline(v)}} trackColor={{true:THEME.success}}/></View>
      {!online && <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text style={{color:'#666'}}>You are OFFLINE</Text></View>}
      {online && <FlatList data={missions} keyExtractor={i=>i.id} renderItem={({item}) => (<View style={styles.historyCard}><Text style={{color:THEME.primary, fontWeight:'bold', fontSize:18}}>{item.price}</Text><Text style={{color:'#FFF', marginVertical:5}}>To: {item.dropoff}</Text><TouchableOpacity onPress={()=>accept(item.id)} style={[styles.primaryBtn, {padding:10, marginTop:10}]}><Text style={styles.btnText}>ACCEPT JOB</Text></TouchableOpacity></View>)} />}
      <TouchableOpacity onPress={()=>supabase.auth.signOut()} style={{alignItems:'center', padding:20}}><Text style={{color:THEME.danger}}>LOGOUT</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.darkBg },
  map: { ...StyleSheet.absoluteFillObject },
  loadingScreen: { flex: 1, backgroundColor: THEME.darkBg, justifyContent: 'center', alignItems: 'center' },
  
  // Header & Navigation
  glassHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: THEME.glass, margin: 10, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  headerSub: { color: THEME.success, fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
  iconBtn: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  
  // KPI Cards (Admin)
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  kpiCard: { flex: 1, backgroundColor: THEME.glass, margin: 5, padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  kpiLabel: { color: '#888', fontSize: 10, fontWeight: '900', marginBottom: 5 },
  kpiValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  // Bottom Sheet (Admin)
  bottomSheet: { backgroundColor: THEME.darkBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '40%', borderWidth: 1, borderColor: '#333' },
  adminListRow: { flexDirection: 'row', backgroundColor: '#1A1A1C', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // Tab Bar
  tabBarContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: THEME.glass, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 40, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, gap: 40 },
  tabBtn: { alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 4, height: 4, backgroundColor: THEME.primary, borderRadius: 2, marginTop: 4 },

  // Forms
  bottomPanelWrapper: { flex: 1, justifyContent: 'flex-end' },
  glassPanel: { backgroundColor: THEME.cardBg, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  inputGroup: { flexDirection: 'row', backgroundColor: '#202022', padding: 16, borderRadius: 16, alignItems: 'center' },
  cleanInput: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500' },
  suggestionOverlay: { position: 'absolute', bottom: 90, left: 20, right: 20, backgroundColor: '#202022', borderRadius: 16, padding: 10, zIndex: 100, borderWidth: 1, borderColor: '#333' },
  suggestionRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#333' },
  
  // Buttons
  actionBtn: { backgroundColor: THEME.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  actionBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  primaryBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#000', fontWeight: 'bold' },
  smallBtn: { padding: 10, borderRadius: 8, alignItems: 'center' },
  outlineBtn: { borderWidth: 1, borderColor: THEME.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  logoutBtn: { margin: 20, alignItems: 'center', padding: 15, backgroundColor: '#1A1A1C', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  bioBtn: { alignItems:'center', marginTop: 20, backgroundColor: '#222', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },

  // Auth
  authContainer: { flex: 1, backgroundColor: THEME.darkBg, justifyContent: 'center', padding: 20 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoBadge: { width: 80, height: 80, backgroundColor: '#1A1A1C', borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  logoText: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: 4 },
  logoSub: { color: THEME.primary, letterSpacing: 6, fontWeight: 'bold', fontSize: 12 },
  authCard: { backgroundColor: THEME.cardBg, padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#222' },
  welcomeText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', letterSpacing: 2 },
  input: { backgroundColor: '#202022', color: '#FFF', padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2D' },
  linkText: { color: THEME.subtext, textAlign: 'center', marginTop: 20 },

  // History & Account
  pageTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', padding: 20, letterSpacing: -1 },
  historyCard: { backgroundColor: THEME.cardBg, marginHorizontal: 20, marginBottom: 12, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#222' },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#202022', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  settingsSection: { backgroundColor: '#18181B', marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  sectionHeader: { color: THEME.subtext, fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  settingInput: { backgroundColor: '#000', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
});