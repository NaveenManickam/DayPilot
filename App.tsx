import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

type Tab = "My Day" | "Planner" | "Notes" | "Progress";
type Task = { id: string; title: string; date: string; done: boolean; priority: "High"|"Medium"|"Low"; note?: string };
type Habit = { id: string; title: string; doneDates: string[]; icon: string; colour: string };
type Note = { id: string; title: string; body: string; updatedAt: string };
type EventItem = { id: string; title: string; date: string; start: string; end: string; location?: string; category: string };
type Store = { name: string; tasks: Task[]; habits: Habit[]; notes: Note[]; events: EventItem[]; dark: boolean };

const KEY = "daypilot.local.v1";
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const initial: Store = {
  name: "",
  tasks: [],
  habits: [
    { id: "h1", title: "Drink water", icon: "💧", colour: "#DCEBE2", doneDates: [] },
    { id: "h2", title: "Read 10 pages", icon: "📖", colour: "#F2E8D8", doneDates: [] },
    { id: "h3", title: "Walk", icon: "🚶", colour: "#E6E8D8", doneDates: [] }
  ],
  notes: [],
  events: [],
  dark: false
};
const quotes = [
  "Small steps every day lead to remarkable change.",
  "Focus on progress, not perfection.",
  "The secret of getting ahead is getting started.",
  "A calm mind brings inner strength and self-confidence."
];
const palette = {
  light: { bg:"#F5F6F0", card:"#FFFFFF", text:"#202820", muted:"#7B847B", line:"#E6E9E1", green:"#486B53", soft:"#E6EEE5", danger:"#B94B45", amber:"#B07A35" },
  dark: { bg:"#151B17", card:"#202923", text:"#F0F3ED", muted:"#A1ADA3", line:"#344139", green:"#A6C5A8", soft:"#2C3A30", danger:"#F08C83", amber:"#E0B36D" }
};

function dateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 16 ? "Good afternoon" : h < 20 ? "Good evening" : "Good night";
}
function AppInner() {
  const [store, setStore] = useState<Store>(initial);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("My Day");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [modal, setModal] = useState<"task"|"habit"|"event"|"note"|"quick"|null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(todayKey());
  const [priority, setPriority] = useState<"High"|"Medium"|"Low">("Medium");
  const [nameDraft, setNameDraft] = useState("");
  const [showName, setShowName] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(raw => {
      if (raw) setStore({ ...initial, ...JSON.parse(raw) });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(store)).catch(() => {});
  }, [store, loaded]);

  const c = store.dark ? palette.dark : palette.light;
  const today = todayKey();
  const todayTasks = store.tasks.filter(t => t.date === selectedDate && !t.done);
  const doneHabits = store.habits.filter(h => h.doneDates.includes(selectedDate));
  const pendingHabits = store.habits.filter(h => !h.doneDates.includes(selectedDate));
  const monthDate = new Date();
  monthDate.setDate(1);
  monthDate.setMonth(monthDate.getMonth()+monthOffset);
  const monthTitle = monthDate.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const monthCells = useMemo(() => {
    const first = new Date(monthDate.getFullYear(),monthDate.getMonth(),1).getDay();
    const days = new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate();
    return [...Array(first).fill(null), ...Array.from({length:days},(_,i)=>i+1)];
  }, [monthOffset]);

  const update = (patch: Partial<Store>) => setStore(s => ({...s,...patch}));
  const openModal = (kind: "task"|"habit"|"event"|"note") => {
    setTitle(""); setBody(""); setDate(selectedDate); setPriority("Medium"); setModal(kind);
  };
  const save = () => {
    if (!title.trim()) { Alert.alert("Add a title", "Please enter a title before saving."); return; }
    if (modal === "task") update({tasks:[...store.tasks,{id:uid(),title:title.trim(),date,done:false,priority,note:body.trim()}]});
    if (modal === "habit") update({habits:[...store.habits,{id:uid(),title:title.trim(),icon:"🌱",colour:"#E6EEE5",doneDates:[]}]});
    if (modal === "note") update({notes:[{id:uid(),title:title.trim(),body:body.trim(),updatedAt:new Date().toISOString()},...store.notes]});
    if (modal === "event") update({events:[...store.events,{id:uid(),title:title.trim(),date,start:"09:00",end:"10:00",location:body.trim(),category:"Personal"}]});
    setModal(null);
  };
  const toggleTask = (id:string) => update({tasks:store.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)});
  const toggleHabit = (id:string) => update({habits:store.habits.map(h=>h.id===id?{...h,doneDates:h.doneDates.includes(selectedDate)?h.doneDates.filter(d=>d!==selectedDate):[...h.doneDates,selectedDate]}:h)});
  const deleteNote = (id:string) => Alert.alert("Delete note?", "This note will be removed from this device.", [{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:()=>update({notes:store.notes.filter(n=>n.id!==id)})}]);
  const card = (children:React.ReactNode, style:any={}) => <View style={[styles.card,{backgroundColor:c.card,borderColor:c.line},style]}>{children}</View>;
  const label = (s:string) => <Text style={[styles.sectionTitle,{color:c.text}]}>{s}</Text>;
  const pill = (s:string, active:boolean, onPress:()=>void) => <Pressable onPress={onPress} style={[styles.pill,{backgroundColor:active?c.soft:c.card,borderColor:active?c.green:c.line}]}><Text style={{color:active?c.green:c.muted,fontWeight:"600"}}>{s}</Text></Pressable>;

  const renderDay = () => <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.topRow}>
      <View style={{flex:1}}>
        <Text style={[styles.eyebrow,{color:c.muted}]}>{dateLabel(new Date(selectedDate+"T12:00:00"))}</Text>
        <Text style={[styles.greeting,{color:c.text}]}>{greeting()}{store.name ? `, ${store.name}` : ""}.</Text>
      </View>
      <Pressable onPress={()=>{setNameDraft(store.name);setShowName(true)}} style={[styles.avatar,{backgroundColor:c.soft}]}><Text style={{fontSize:19}}>☺</Text></Pressable>
    </View>
    <View style={[styles.quote,{backgroundColor:c.soft}]}>
      <Text style={{color:c.green,fontSize:13,fontWeight:"700",marginBottom:5}}>A THOUGHT FOR TODAY</Text>
      <Text style={{color:c.text,fontSize:15,lineHeight:22,fontWeight:"500"}}>“{quotes[new Date().getDate()%quotes.length]}”</Text>
    </View>
    <View style={styles.dateStrip}>
      <Pressable onPress={()=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()-1);setSelectedDate(todayKeyFrom(d));}}><Text style={[styles.arrow,{color:c.green}]}>‹</Text></Pressable>
      <Pressable onPress={()=>setSelectedDate(today)}><Text style={[styles.dateCenter,{color:c.text}]}>{selectedDate===today?"Today":new Date(selectedDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</Text></Pressable>
      <Pressable onPress={()=>{const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+1);setSelectedDate(todayKeyFrom(d));}}><Text style={[styles.arrow,{color:c.green}]}>›</Text></Pressable>
    </View>
    {label("Habits")}
    {pendingHabits.length===0 ? card(<Text style={{color:c.green,fontWeight:"600"}}>All habits completed! 🎉</Text>) :
      <View style={styles.habitGrid}>{pendingHabits.map(h=><Pressable key={h.id} onPress={()=>toggleHabit(h.id)} style={[styles.habitCard,{backgroundColor:h.colour,borderColor:h.colour}]}>
        <Text style={{fontSize:24}}>{h.icon}</Text><Text style={{color:"#26352A",fontWeight:"700",marginTop:12}}>{h.title}</Text><Text style={{color:"#526458",fontSize:12,marginTop:4}}>Tap to complete ○</Text>
      </Pressable>)}</View>}
    {doneHabits.length>0 && <Text style={{color:c.muted,fontSize:12,marginTop:8}}>{doneHabits.length} completed today</Text>}
    <View style={styles.sectionRow}>{label("Tasks")}<Pressable onPress={()=>openModal("task")}><Text style={{color:c.green,fontWeight:"700"}}>+ Add</Text></Pressable></View>
    {todayTasks.length===0 ? card(<Text style={{color:c.muted}}>All tasks completed! 🎉</Text>) : todayTasks.map(t=>card(<View key={t.id} style={styles.taskRow}>
      <Pressable onPress={()=>toggleTask(t.id)} style={[styles.check,{borderColor:c.green}]} />
      <View style={{flex:1}}><Text style={{color:c.text,fontWeight:"600"}}>{t.title}</Text><Text style={{color:t.date<today?c.danger:c.muted,fontSize:12,marginTop:3}}>{t.date<today?"Overdue":t.priority+" priority"}</Text></View>
      <Pressable onPress={()=>toggleTask(t.id)}><Text style={{color:c.muted,fontSize:18}}>✓</Text></Pressable>
    </View>,{marginBottom:8}))}
    <Text style={{color:c.muted,fontSize:12,marginTop:8}}>Your information is saved on this device.</Text>
  </ScrollView>;

  const renderPlanner = () => <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.topRow}><View><Text style={[styles.eyebrow,{color:c.muted}]}>PLAN AHEAD</Text><Text style={[styles.greeting,{color:c.text}]}>My Planner</Text></View><Pressable onPress={()=>openModal("event")}><Text style={{color:c.green,fontWeight:"700"}}>+ Event</Text></Pressable></View>
    {card(<>
      <View style={styles.monthHeader}><Pressable onPress={()=>setMonthOffset(x=>x-1)}><Text style={[styles.arrow,{color:c.green}]}>‹</Text></Pressable><Text style={[styles.sectionTitle,{color:c.text}]}>{monthTitle}</Text><Pressable onPress={()=>setMonthOffset(x=>x+1)}><Text style={[styles.arrow,{color:c.green}]}>›</Text></Pressable></View>
      <View style={styles.calendarGrid}>{["S","M","T","W","T","F","S"].map((d,i)=><Text key={i} style={[styles.weekday,{color:c.muted}]}>{d}</Text>)}
      {monthCells.map((day,i)=>{if(!day)return <View key={"blank"+i} style={styles.dayCell}/>;const key=`${monthDate.getFullYear()}-${String(monthDate.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const active=key===selectedDate;const has=store.events.some(e=>e.date===key);return <Pressable key={key} onPress={()=>setSelectedDate(key)} style={[styles.dayCell,active&&{backgroundColor:c.green,borderRadius:18}]}><Text style={{color:active?"white":c.text,fontWeight:active?"700":"500"}}>{day}</Text>{has&&<View style={[styles.dot,{backgroundColor:active?"white":c.green}]}/>}</Pressable>})}</View>
    </>)}
    <View style={styles.sectionRow}>{label("Selected date")}<Text style={{color:c.muted}}>{selectedDate}</Text></View>
    {store.events.filter(e=>e.date===selectedDate).length===0 ? card(<Text style={{color:c.muted}}>No events planned for this date.</Text>) : store.events.filter(e=>e.date===selectedDate).map(e=>card(<View key={e.id}><Text style={{color:c.text,fontWeight:"700"}}>{e.title}</Text><Text style={{color:c.muted,marginTop:5}}>{e.start} – {e.end} · {e.category}</Text>{e.location?<Text style={{color:c.muted,fontSize:12,marginTop:3}}>{e.location}</Text>:null}</View>))}
    <View style={styles.sectionRow}>{label("Date-based note")}<Pressable onPress={()=>openModal("note")}><Text style={{color:c.green,fontWeight:"700"}}>+ Note</Text></Pressable></View>
    <Text style={{color:c.muted,fontSize:13}}>Date-based notes will be added in the next iteration.</Text>
  </ScrollView>;

  const renderNotes = () => <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.topRow}><View><Text style={[styles.eyebrow,{color:c.muted}]}>YOUR THOUGHTS</Text><Text style={[styles.greeting,{color:c.text}]}>My Notes</Text></View><Pressable onPress={()=>openModal("note")}><Text style={{color:c.green,fontWeight:"700"}}>+ New note</Text></Pressable></View>
    {store.notes.length===0 ? card(<View style={{alignItems:"center",padding:20}}><Text style={{fontSize:32}}>✎</Text><Text style={{color:c.text,fontWeight:"700",marginTop:10}}>No notes yet</Text><Text style={{color:c.muted,marginTop:5}}>Save ideas, reminders and thoughts here.</Text></View>) :
      store.notes.map(n=>card(<View key={n.id}><View style={styles.sectionRow}><Text style={{color:c.text,fontWeight:"700",fontSize:16,flex:1}}>{n.title}</Text><Pressable onPress={()=>deleteNote(n.id)}><Text style={{color:c.danger}}>Delete</Text></Pressable></View><Text style={{color:c.muted,lineHeight:21,marginTop:8}}>{n.body}</Text></View>,{marginBottom:10}))}
  </ScrollView>;

  const renderProgress = () => {
    const completed = store.tasks.filter(t=>t.done).length;
    const total = store.tasks.length;
    const habitDone = store.habits.reduce((n,h)=>n+h.doneDates.length,0);
    return <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow,{color:c.muted}]}>YOUR CONSISTENCY</Text><Text style={[styles.greeting,{color:c.text}]}>My Progress</Text>
      <View style={styles.statGrid}>{[[String(completed), "Tasks completed"],[String(total), "Tasks created"],[String(habitDone),"Habit check-ins"],[String(store.habits.length),"Active habits"]].map(([v,l])=>card(<><Text style={[styles.statValue,{color:c.text}]}>{v}</Text><Text style={{color:c.muted,fontSize:12,marginTop:5}}>{l}</Text></>,{flex:1,marginBottom:0}))}</View>
      {label("A steady routine")}
      {card(<><Text style={{color:c.text,fontWeight:"700"}}>Habit activity</Text>{store.habits.map(h=><View key={h.id} style={{marginTop:14}}><View style={styles.sectionRow}><Text style={{color:c.text}}>{h.icon} {h.title}</Text><Text style={{color:c.muted}}>{h.doneDates.length} check-ins</Text></View><View style={[styles.progressTrack,{backgroundColor:c.line}]}><View style={[styles.progressFill,{backgroundColor:c.green,width:`${Math.min(100,h.doneDates.length*10)}%`}]}/></View></View>)}</>)}
      <Text style={{color:c.muted,fontSize:12,marginTop:10}}>Detailed weekly, monthly and yearly reports are planned for a later release.</Text>
    </ScrollView>;
  };

  if (!loaded) return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]}><Text style={{color:c.text,padding:24}}>Loading DayPilot…</Text></SafeAreaView>;
  return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={["top","left","right"]}>
    <StatusBar barStyle={store.dark?"light-content":"dark-content"} />
    <View style={{flex:1}}>
      {tab==="My Day"?renderDay():tab==="Planner"?renderPlanner():tab==="Notes"?renderNotes():renderProgress()}
      <View style={[styles.bottomNav,{backgroundColor:c.card,borderColor:c.line}]}>
        {(["My Day","Planner","Notes","Progress"] as Tab[]).map((t,i)=><Pressable key={t} onPress={()=>setTab(t)} style={styles.navItem}><Text style={{fontSize:18,color:tab===t?c.green:c.muted}}>{["◷","▦","▤","◫"][i]}</Text><Text style={{fontSize:10,fontWeight:tab===t?"700":"500",color:tab===t?c.green:c.muted,marginTop:4}}>{t}</Text></Pressable>)}
        <Pressable onPress={()=>setModal("quick")} style={[styles.fab,{backgroundColor:c.green}]}><Text style={{fontSize:27,color:"#fff",lineHeight:30}}>+</Text></Pressable>
      </View>
    </View>
    <Modal visible={modal!==null} animationType="slide" transparent onRequestClose={()=>setModal(null)}>
      <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS==="ios"?"padding":undefined}>
        <View style={[styles.sheet,{backgroundColor:c.card}]}>
          {modal==="quick" ? <>
            <View style={styles.sectionRow}><Text style={[styles.sectionTitle,{color:c.text}]}>Quick add</Text><Pressable onPress={()=>setModal(null)}><Text style={{color:c.muted}}>Close</Text></Pressable></View>
            <View style={styles.quickGrid}>{[["✓","Task","task"],["🌱","Habit","habit"],["▦","Event","event"],["✎","Note","note"]].map(([icon,name,key])=><Pressable key={key} onPress={()=>openModal(key as any)} style={[styles.quickItem,{backgroundColor:c.soft}]}><Text style={{fontSize:25}}>{icon}</Text><Text style={{color:c.text,fontWeight:"600",marginTop:8}}>{name}</Text></Pressable>)}</View>
          </> : <>
            <View style={styles.sectionRow}><Text style={[styles.sectionTitle,{color:c.text}]}>{modal==="task"?"New task":modal==="habit"?"New habit":modal==="event"?"New event":"New note"}</Text><Pressable onPress={()=>setModal(null)}><Text style={{color:c.muted}}>Cancel</Text></Pressable></View>
            <Text style={[styles.fieldLabel,{color:c.muted}]}>TITLE</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Give it a name" placeholderTextColor={c.muted} style={[styles.input,{color:c.text,borderColor:c.line}]} />
            {modal==="task"||modal==="event" ? <><Text style={[styles.fieldLabel,{color:c.muted}]}>DATE (YYYY-MM-DD)</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted} style={[styles.input,{color:c.text,borderColor:c.line}]} /></>:null}
            {modal==="task" ? <><Text style={[styles.fieldLabel,{color:c.muted}]}>PRIORITY</Text><View style={styles.pillRow}>{(["Low","Medium","High"] as const).map(p=>pill(p,priority===p,()=>setPriority(p)))}</View></>:null}
            {modal==="task"||modal==="note"||modal==="event" ? <><Text style={[styles.fieldLabel,{color:c.muted}]}>{modal==="event"?"LOCATION / DETAILS":"NOTES"}</Text><TextInput value={body} onChangeText={setBody} multiline placeholder="Add more details (optional)" placeholderTextColor={c.muted} style={[styles.input,{color:c.text,borderColor:c.line,minHeight:90,textAlignVertical:"top"}]} /></>:null}
            <Pressable onPress={save} style={[styles.saveButton,{backgroundColor:c.green}]}><Text style={{color:"#fff",fontWeight:"700",fontSize:15}}>Save</Text></Pressable>
          </>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={showName} transparent animationType="fade" onRequestClose={()=>setShowName(false)}>
      <View style={styles.modalShade}><View style={[styles.nameDialog,{backgroundColor:c.card}]}><Text style={[styles.sectionTitle,{color:c.text}]}>What should we call you?</Text><TextInput value={nameDraft} onChangeText={setNameDraft} placeholder="Your name" placeholderTextColor={c.muted} style={[styles.input,{color:c.text,borderColor:c.line,marginTop:16}]}/><Pressable onPress={()=>{update({name:nameDraft.trim()});setShowName(false)}} style={[styles.saveButton,{backgroundColor:c.green}]}><Text style={{color:"#fff",fontWeight:"700"}}>Save</Text></Pressable></View></View>
    </Modal>
  </SafeAreaView>;
}
function todayKeyFrom(d:Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export default function App() { return <SafeAreaProvider><AppInner/></SafeAreaProvider>; }

const styles = StyleSheet.create({
  safe:{flex:1}, content:{paddingHorizontal:20,paddingTop:18,paddingBottom:28},
  topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  eyebrow:{fontSize:11,fontWeight:"800",letterSpacing:1.2,textTransform:"uppercase"},
  greeting:{fontSize:27,fontWeight:"800",letterSpacing:-0.7,marginTop:5},
  avatar:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center"},
  quote:{padding:16,borderRadius:18,marginBottom:22},
  dateStrip:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:28,marginBottom:22},
  arrow:{fontSize:30,fontWeight:"400",paddingHorizontal:8},
  dateCenter:{fontWeight:"700",fontSize:14,minWidth:80,textAlign:"center"},
  sectionTitle:{fontSize:18,fontWeight:"800",letterSpacing:-0.3},
  sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  card:{padding:16,borderRadius:18,borderWidth:1,marginBottom:12},
  habitGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:12,marginBottom:18},
  habitCard:{width:"48%",minHeight:126,borderRadius:17,padding:14,borderWidth:1,justifyContent:"center"},
  taskRow:{flexDirection:"row",alignItems:"center",gap:12},
  check:{width:21,height:21,borderRadius:11,borderWidth:1.5},
  bottomNav:{height:70,borderTopWidth:1,flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingHorizontal:10},
  navItem:{alignItems:"center",justifyContent:"center",minWidth:58},
  fab:{position:"absolute",right:18,bottom:82,width:54,height:54,borderRadius:27,alignItems:"center",justifyContent:"center",elevation:5},
  modalShade:{flex:1,backgroundColor:"rgba(0,0,0,0.35)",justifyContent:"flex-end"},
  sheet:{borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:32,minHeight:300},
  nameDialog:{margin:24,padding:22,borderRadius:22},
  input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,marginTop:7},
  fieldLabel:{fontSize:10,fontWeight:"800",letterSpacing:1.1,marginTop:16},
  saveButton:{height:50,borderRadius:14,alignItems:"center",justifyContent:"center",marginTop:22},
  pillRow:{flexDirection:"row",gap:8,marginTop:10},
  pill:{borderWidth:1,borderRadius:20,paddingHorizontal:15,paddingVertical:9},
  quickGrid:{flexDirection:"row",flexWrap:"wrap",gap:12,marginTop:20},
  quickItem:{width:"47%",height:104,borderRadius:17,alignItems:"center",justifyContent:"center"},
  monthHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  calendarGrid:{flexDirection:"row",flexWrap:"wrap"},
  weekday:{width:"14.2857%",textAlign:"center",fontSize:11,fontWeight:"700",paddingBottom:12},
  dayCell:{width:"14.2857%",height:42,alignItems:"center",justifyContent:"center"},
  dot:{width:4,height:4,borderRadius:2,marginTop:2},
  statGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginVertical:18},
  statValue:{fontSize:26,fontWeight:"800"},
  progressTrack:{height:7,borderRadius:5,overflow:"hidden",marginTop:8},
  progressFill:{height:7,borderRadius:5}
});