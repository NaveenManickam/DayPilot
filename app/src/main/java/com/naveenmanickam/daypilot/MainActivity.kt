package com.naveenmanickam.daypilot

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val Forest = Color(0xFF486B53)
private val Canvas = Color(0xFFF5F6F0)
private val Ink = Color(0xFF202820)
private val Muted = Color(0xFF7B847B)
private val Soft = Color(0xFFE6EEE5)

data class TaskItem(
    val id: String, val title: String, val date: String,
    val done: Boolean = false, val priority: String = "Medium", val note: String = ""
)
data class HabitItem(
    val id: String, val title: String, val icon: String,
    val doneDates: Set<String> = emptySet()
)
data class NoteItem(val id: String, val title: String, val body: String, val date: String)
data class EventItem(
    val id: String, val title: String, val date: String,
    val start: String = "09:00", val end: String = "10:00",
    val location: String = "", val category: String = "Personal"
)
data class DayPilotState(
    val name: String = "",
    val dark: Boolean = false,
    val tasks: List<TaskItem> = emptyList(),
    val habits: List<HabitItem> = listOf(
        HabitItem("h1", "Drink water", "💧"),
        HabitItem("h2", "Read 10 pages", "📖"),
        HabitItem("h3", "Walk", "🚶")
    ),
    val notes: List<NoteItem> = emptyList(),
    val events: List<EventItem> = emptyList()
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { DayPilotApp(this) }
    }
}

private fun loadState(context: Context): DayPilotState {
    val raw = context.getSharedPreferences("daypilot", Context.MODE_PRIVATE).getString("state", null)
        ?: return DayPilotState()
    return runCatching {
        val root = JSONObject(raw)
        val tasks = root.optJSONArray("tasks").toItems { o ->
            TaskItem(o.getString("id"), o.getString("title"), o.getString("date"),
                o.optBoolean("done"), o.optString("priority", "Medium"), o.optString("note"))
        }
        val habits = root.optJSONArray("habits").toItems { o ->
            val dates = o.optJSONArray("doneDates").toStrings().toSet()
            HabitItem(o.getString("id"), o.getString("title"), o.optString("icon", "🌱"), dates)
        }
        val notes = root.optJSONArray("notes").toItems { o ->
            NoteItem(o.getString("id"), o.getString("title"), o.optString("body"), o.optString("date"))
        }
        val events = root.optJSONArray("events").toItems { o ->
            EventItem(o.getString("id"), o.getString("title"), o.getString("date"),
                o.optString("start", "09:00"), o.optString("end", "10:00"),
                o.optString("location"), o.optString("category", "Personal"))
        }
        DayPilotState(root.optString("name"), root.optBoolean("dark"), tasks,
            habits.ifEmpty { DayPilotState().habits }, notes, events)
    }.getOrDefault(DayPilotState())
}

private fun JSONArray?.toStrings(): List<String> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optString(it, null) }

private inline fun <T> JSONArray?.toItems(read: (JSONObject) -> T): List<T> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { i ->
        runCatching { read(getJSONObject(i)) }.getOrNull()
    }

private fun saveState(context: Context, state: DayPilotState) {
    val root = JSONObject().put("name", state.name).put("dark", state.dark)
    root.put("tasks", JSONArray().apply { state.tasks.forEach {
        put(JSONObject().put("id", it.id).put("title", it.title).put("date", it.date)
            .put("done", it.done).put("priority", it.priority).put("note", it.note))
    }})
    root.put("habits", JSONArray().apply { state.habits.forEach {
        put(JSONObject().put("id", it.id).put("title", it.title).put("icon", it.icon)
            .put("doneDates", JSONArray(it.doneDates.toList())))
    }})
    root.put("notes", JSONArray().apply { state.notes.forEach {
        put(JSONObject().put("id", it.id).put("title", it.title).put("body", it.body).put("date", it.date))
    }})
    root.put("events", JSONArray().apply { state.events.forEach {
        put(JSONObject().put("id", it.id).put("title", it.title).put("date", it.date)
            .put("start", it.start).put("end", it.end).put("location", it.location).put("category", it.category))
    }})
    context.getSharedPreferences("daypilot", Context.MODE_PRIVATE).edit().putString("state", root.toString()).apply()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DayPilotApp(context: Context) {
    var data by remember { mutableStateOf(loadState(context)) }
    var tab by remember { mutableStateOf("My Day") }
    var selectedDate by remember { mutableStateOf(LocalDate.now()) }
    var dialog by remember { mutableStateOf<String?>(null) }
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("Medium") }
    var search by remember { mutableStateOf("") }
    var month by remember { mutableStateOf(LocalDate.now().withDayOfMonth(1)) }
    var editingNote by remember { mutableStateOf<String?>(null) }

    fun update(next: DayPilotState) {
        data = next
        saveState(context, next)
    }
    fun open(kind: String) {
        title = ""; details = ""; priority = "Medium"; editingNote = null; dialog = kind
    }

    val dark = data.dark
    val bg = if (dark) Color(0xFF151B17) else Canvas
    val card = if (dark) Color(0xFF202923) else Color.White
    val text = if (dark) Color(0xFFF0F3ED) else Ink
    val muted = if (dark) Color(0xFFA1ADA3) else Muted
    val line = if (dark) Color(0xFF344139) else Color(0xFFE6E9E1)
    val primary = if (dark) Color(0xFFA6C5A8) else Forest
    val today = LocalDate.now()
    val dateKey = selectedDate.toString()
    val visibleTasks = data.tasks.filter {
        !it.done && (if (selectedDate == today) it.date <= dateKey else it.date == dateKey) && it.title.contains(search, ignoreCase = true)
    }.sortedBy { it.date }
    val pendingHabits = data.habits.filter { dateKey !in it.doneDates }

    MaterialTheme(colorScheme = if (dark) darkColorScheme(
        primary = primary, background = bg, surface = card, onSurface = text
    ) else lightColorScheme(primary = primary, background = bg, surface = card, onSurface = text)) {
        Scaffold(
            containerColor = bg,
            floatingActionButton = {
                FloatingActionButton(onClick = { dialog = "quick" }, containerColor = primary, contentColor = Color.White) {
                    Text("+", fontSize = 28.sp, fontWeight = FontWeight.Light)
                }
            },
            bottomBar = {
                NavigationBar(containerColor = card, contentColor = primary) {
                    listOf("My Day", "Planner", "Notes", "Progress").forEach { item ->
                        NavigationBarItem(
                            selected = tab == item,
                            onClick = { tab = item },
                            icon = { Text(when (item) { "My Day" -> "◷"; "Planner" -> "▦"; "Notes" -> "▤"; else -> "◫" }, fontSize = 19.sp) },
                            label = { Text(item, fontSize = 10.sp) }
                        )
                    }
                }
            }
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp)) {
                when (tab) {
                    "My Day" -> {
                        Spacer(Modifier.height(18.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("${greeting()}${if (data.name.isNotBlank()) ", ${data.name}" else ""}", color = muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Text("You have ${data.tasks.count { it.date.startsWith(today.toString().take(7)) }} tasks this month 👏", color = text, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Surface(shape = CircleShape, color = Soft, modifier = Modifier.size(44.dp).clickable { open("name") }) {
                                Box(contentAlignment = Alignment.Center) { Text("☺", fontSize = 22.sp, color = Forest) }
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        OutlinedTextField(search, { search = it }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("Search a task…") })
                        Spacer(Modifier.height(18.dp))
                        SectionHeader("Habits", muted, text) { open("habit") }
                        if (pendingHabits.isEmpty()) {
                            InfoCard("All habits completed! 🎉", card, text)
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                                pendingHabits.chunked(2).forEach { row ->
                                    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                        row.forEach { habit ->
                                            Card(
                                                modifier = Modifier.weight(1f).clickable {
                                                    val changed = data.habits.map { h ->
                                                        if (h.id == habit.id) h.copy(doneDates = h.doneDates + dateKey) else h
                                                    }
                                                    update(data.copy(habits = changed))
                                                },
                                                colors = CardDefaults.cardColors(containerColor = Soft),
                                                shape = RoundedCornerShape(17.dp)
                                            ) {
                                                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                                                    Text(habit.icon, fontSize = 24.sp)
                                                    Text(habit.title, color = Ink, fontWeight = FontWeight.Bold)
                                                    Text("Tap to complete ○", color = Color(0xFF526458), fontSize = 11.sp)
                                                }
                                            }
                                        }
                                        if (row.size == 1) Spacer(Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(18.dp))
                        SectionHeader("Today's Tasks", muted, text) { open("task") }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("‹", color = primary, fontSize = 26.sp, modifier = Modifier.clickable { selectedDate = selectedDate.minusDays(1) }.padding(horizontal = 12.dp))
                            Text(if (selectedDate == today) "Today" else selectedDate.format(DateTimeFormatter.ofPattern("EEE, d MMM")), color = text, fontWeight = FontWeight.Bold)
                            Text("›", color = primary, fontSize = 26.sp, modifier = Modifier.clickable { selectedDate = selectedDate.plusDays(1) }.padding(horizontal = 12.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                        if (visibleTasks.isEmpty()) InfoCard(if (search.isBlank()) "No pending tasks. Add one to get started." else "No matching tasks.", card, muted)
                        else LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.weight(1f)) {
                            items(visibleTasks, key = { it.id }) { task ->
                                Card(colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(16.dp)) {
                                    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Column(Modifier.weight(1f)) {
                                            Text(task.title, color = text, fontWeight = FontWeight.Bold)
                                            Text("${if (task.date < today.toString()) "Overdue · " else ""}${task.priority} priority", color = muted, fontSize = 11.sp)
                                        }
                                        Checkbox(checked = false, onCheckedChange = {
                                            update(data.copy(tasks = data.tasks.map { t -> if (t.id == task.id) t.copy(done = true) else t }))
                                        })
                                    }
                                }
                            }
                        }
                        Card(colors = CardDefaults.cardColors(containerColor = if (dark) Color(0xFF2C3A30) else Soft), shape = RoundedCornerShape(17.dp)) {
                            Column(Modifier.fillMaxWidth().padding(14.dp)) {
                                Text("A THOUGHT FOR TODAY", color = primary, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                                Text("“${listOf("Small steps every day lead to remarkable change.", "Focus on progress, not perfection.", "The secret of getting ahead is getting started.", "A calm mind brings inner strength and self-confidence.")[today.dayOfMonth % 4]}”", color = text, fontSize = 13.sp)
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    "Planner" -> {
                        Spacer(Modifier.height(18.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("PLAN AHEAD", color = muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("My Planner", color = text, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Text("+ Event", color = primary, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { open("event") })
                        }
                        Spacer(Modifier.height(12.dp))
                        Card(colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(18.dp)) {
                            Column(Modifier.padding(14.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text("‹", fontSize = 26.sp, color = primary, modifier = Modifier.clickable { month = month.minusMonths(1) })
                                    Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy")), color = text, fontWeight = FontWeight.Bold)
                                    Text("›", fontSize = 26.sp, color = primary, modifier = Modifier.clickable { month = month.plusMonths(1) })
                                }
                                Row(Modifier.fillMaxWidth()) {
                                    listOf("S", "M", "T", "W", "T", "F", "S").forEach { Text(it, Modifier.weight(1f), color = muted, fontSize = 11.sp) }
                                }
                                val offset = month.dayOfWeek.value % 7
                                val days = month.lengthOfMonth()
                                val cells = List(offset) { 0 } + (1..days).toList()
                                cells.chunked(7).forEach { week ->
                                    Row(Modifier.fillMaxWidth()) {
                                        week.forEach { day ->
                                            Box(Modifier.weight(1f).height(42.dp).padding(2.dp)
                                                .background(if (day > 0 && selectedDate == month.withDayOfMonth(day)) primary else Color.Transparent, CircleShape)
                                                .clickable(enabled = day > 0) { selectedDate = month.withDayOfMonth(day) },
                                                contentAlignment = Alignment.Center) {
                                                if (day > 0) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Text(day.toString(), color = if (selectedDate == month.withDayOfMonth(day)) Color.White else text, fontSize = 13.sp)
                                                    if (data.events.any { it.date == month.withDayOfMonth(day).toString() }) Box(Modifier.size(4.dp).background(primary, CircleShape))
                                                }
                                            }
                                        }
                                        repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                        Text("Selected date · $dateKey", color = muted, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        val dayEvents = data.events.filter { it.date == dateKey }
                        if (dayEvents.isEmpty()) InfoCard("No events planned for this date.", card, muted)
                        else dayEvents.forEach { EventCard(it, card, text, muted) }
                        Spacer(Modifier.height(12.dp))
                        SectionHeader("Date-based note", muted, text) {
                            val existing = data.notes.firstOrNull { it.date == dateKey }
                            title = existing?.title ?: "Planner note"; details = existing?.body ?: ""; editingNote = existing?.id; dialog = "dateNote"
                        }
                        data.notes.firstOrNull { it.date == dateKey }?.let { InfoCard(it.body, card, text) }
                    }
                    "Notes" -> {
                        Spacer(Modifier.height(18.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("YOUR THOUGHTS", color = muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("My Notes", color = text, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Text("+ New note", color = primary, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { open("note") })
                        }
                        Spacer(Modifier.height(14.dp))
                        if (data.notes.none { it.date.isBlank() }) InfoCard("Your general notes will appear here. Add an idea or reminder.", card, muted)
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(data.notes.filter { it.date.isBlank() }, key = { it.id }) { note ->
                                Card(colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(16.dp)) {
                                    Column(Modifier.fillMaxWidth().padding(15.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(note.title, Modifier.weight(1f), color = text, fontWeight = FontWeight.Bold)
                                            Text("Edit", color = primary, modifier = Modifier.clickable {
                                                title = note.title; details = note.body; editingNote = note.id; dialog = "note"
                                            })
                                            Spacer(Modifier.width(12.dp))
                                            Text("Delete", color = Color(0xFFB94B45), modifier = Modifier.clickable {
                                                update(data.copy(notes = data.notes.filterNot { it.id == note.id }))
                                            })
                                        }
                                        Spacer(Modifier.height(6.dp))
                                        Text(note.body, color = muted, fontSize = 13.sp)
                                    }
                                }
                            }
                        }
                    }
                    else -> {
                        Spacer(Modifier.height(18.dp))
                        Text("YOUR CONSISTENCY", color = muted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text("My Progress", color = text, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            StatCard(data.tasks.count { it.done }.toString(), "Tasks completed", card, text, Modifier.weight(1f))
                            StatCard(data.tasks.size.toString(), "Tasks created", card, text, Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(9.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            StatCard(data.habits.sumOf { it.doneDates.size }.toString(), "Habit check-ins", card, text, Modifier.weight(1f))
                            StatCard(data.habits.size.toString(), "Active habits", card, text, Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(18.dp))
                        Text("Habit activity", color = text, fontWeight = FontWeight.Bold)
                        data.habits.forEach { habit ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${habit.icon} ${habit.title}", color = text)
                                Text("${habit.doneDates.size} check-ins", color = muted, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    if (dialog != null) {
        when (dialog) {
            "quick" -> AlertDialog(
                onDismissRequest = { dialog = null },
                title = { Text("Quick add") },
                text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Task", "Habit", "Event", "Note").forEach { choice ->
                        OutlinedButton(onClick = { open(choice.lowercase()) }, modifier = Modifier.fillMaxWidth()) { Text(choice) }
                    }
                }},
                confirmButton = { TextButton(onClick = { dialog = null }) { Text("Close") } }
            )
            "name" -> AlertDialog(
                onDismissRequest = { dialog = null },
                title = { Text("What should we call you?") },
                text = { OutlinedTextField(data.name, { update(data.copy(name = it)) }, label = { Text("Your name") }) },
                confirmButton = { TextButton(onClick = { dialog = null }) { Text("Done") } }
            )
            else -> {
                val kind = dialog!!
                AlertDialog(
                    onDismissRequest = { dialog = null },
                    title = { Text(when (kind) { "task" -> "New task"; "habit" -> "New habit"; "event" -> "New event"; "dateNote" -> "Planner note"; else -> if (editingNote != null) "Edit note" else "New note" }) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (kind != "dateNote") OutlinedTextField(title, { title = it }, label = { Text("Title") }, singleLine = true)
                            if (kind == "task" || kind == "event") OutlinedTextField(dateKey, { value -> runCatching { selectedDate = LocalDate.parse(value) } }, label = { Text("Selected date: YYYY-MM-DD") }, singleLine = true)
                            if (kind == "task") {
                                Text("Priority", color = muted)
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf("Low", "Medium", "High").forEach { p ->
                                        FilterChip(selected = priority == p, onClick = { priority = p }, label = { Text(p) })
                                    }
                                }
                            }
                            if (kind == "note" || kind == "dateNote" || kind == "task" || kind == "event") {
                                OutlinedTextField(details, { details = it }, label = { Text(if (kind == "event") "Location / details" else "Details") }, minLines = 2)
                            }
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = {
                            val id = editingNote ?: System.currentTimeMillis().toString()
                            when (kind) {
                                "task" -> if (title.isNotBlank()) update(data.copy(tasks = data.tasks + TaskItem(id, title.trim(), selectedDate.toString(), priority = priority, note = details)))
                                "habit" -> if (title.isNotBlank()) update(data.copy(habits = data.habits + HabitItem(id, title.trim(), "🌱")))
                                "event" -> if (title.isNotBlank()) update(data.copy(events = data.events + EventItem(id, title.trim(), selectedDate.toString(), location = details)))
                                "note" -> if (title.isNotBlank()) {
                                    val n = NoteItem(id, title.trim(), details, "")
                                    update(data.copy(notes = if (editingNote == null) data.notes + n else data.notes.map { if (it.id == id) n else it }))
                                }
                                "dateNote" -> {
                                    val n = NoteItem(id, "Planner note", details, selectedDate.toString())
                                    update(data.copy(notes = data.notes.filterNot { it.date == selectedDate.toString() } + n))
                                }
                            }
                            dialog = null
                        }) { Text("Save") }
                    },
                    dismissButton = { TextButton(onClick = { dialog = null }) { Text("Cancel") } }
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(label: String, muted: Color, text: Color, onAdd: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), color = text, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
        Text("+ Add", color = Forest, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onAdd() })
    }
}

@Composable
private fun InfoCard(message: String, card: Color, text: Color) {
    Card(colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(16.dp)) {
        Text(message, Modifier.fillMaxWidth().padding(16.dp), color = text, fontSize = 13.sp)
    }
}

@Composable
private fun EventCard(event: EventItem, card: Color, text: Color, muted: Color) {
    Card(colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(16.dp), modifier = Modifier.padding(bottom = 8.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(event.title, color = text, fontWeight = FontWeight.Bold)
            Text("${event.start} – ${event.end} · ${event.category}", color = muted, fontSize = 12.sp)
            if (event.location.isNotBlank()) Text(event.location, color = muted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun StatCard(value: String, label: String, card: Color, text: Color, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = card), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Text(value, color = text, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
            Text(label, color = Muted, fontSize = 11.sp)
        }
    }
}

private fun greeting(): String = when (LocalTime.now().hour) {
    in 5..11 -> "Good morning"
    in 12..15 -> "Good afternoon"
    in 16..19 -> "Good evening"
    else -> "Good night"
}
