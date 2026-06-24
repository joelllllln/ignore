extends Node2D
## Idle Dot Shooter — main game manager.
##
## Dots spawn at the top of the screen and drift down toward the cannon line.
## Cannons auto-target and fire at the nearest dot. Killing dots awards coins,
## which are spent on upgrades. The slider at the top scales dot speed and
## spawn rate live. If too many dots breach the wall, it's game over.

# --- Layout constants -------------------------------------------------------
const W: float = 1152.0
const H: float = 648.0
const WALL_Y: float = 588.0       # dots crossing this line breach the wall
const CANNON_Y: float = 606.0     # turrets sit just behind the wall
const SPAWN_MARGIN: float = 42.0
const BULLET_SPEED: float = 640.0
const MAX_CANNONS: int = 10

# --- Tunable balance --------------------------------------------------------
const START_WALL_HP: int = 20
const MAX_DRONES: int = 8
const MAX_MULTISHOT_LEVEL: int = 3   # 1 → 2 → 4 → 8 simultaneous targets
const DRONE_CENTER: Vector2 = Vector2(W / 2.0, 340.0)
const DRONE_ORBIT_RADIUS: float = 150.0

# --- Runtime state ----------------------------------------------------------
var difficulty: float = 1.0
var elapsed: float = 0.0
var spawn_timer: float = 0.0

var coins: int = 0
var kills: int = 0
var wall_hp: int = START_WALL_HP
var wall_max_hp: int = START_WALL_HP
var game_over: bool = false

# Upgrade levels — TURRET tree
var dmg_level: int = 0          # Heavy Rounds: ×2 damage per level
var rate_level: int = 0         # Double Barrel: ×2 fire rate per level
var multishot_level: int = 0    # Multishot: ×2 simultaneous targets per level
var cannon_count: int = 1

# Upgrade levels — DRONE tree
var drone_count: int = 0        # Deploy Drone: +1 autonomous combat drone
var drone_rate_level: int = 0   # Overclock: ×2 drone fire rate per level
var drone_dmg_level: int = 0    # Plasma Core: ×2 drone damage per level
var drone_orbit_phase: float = 0.0

# Wall tree
var wall_level: int = 0

# Entity pools (children of this node)
var dots: Array[Dot] = []
var bullets: Array[Bullet] = []
var cannons: Array[Cannon] = []
var drones: Array[Drone] = []

# --- UI references ----------------------------------------------------------
var slider: HSlider
var diff_value_label: Label
var stats_label: Label
var btn_dmg: Button
var btn_rate: Button
var btn_multishot: Button
var btn_cannon: Button
var btn_drone: Button
var btn_drone_rate: Button
var btn_drone_dmg: Button
var btn_wall: Button
var gameover_panel: Panel
var go_label: Label


func _ready() -> void:
	randomize()
	_build_ui()
	add_cannon()  # start with one cannon
	queue_redraw()  # draw the static background/wall once


# ============================================================================
#  DERIVED STATS
# ============================================================================
# --- TURRET tree ------------------------------------------------------------
func bullet_damage() -> float:
	# Heavy Rounds — each level DOUBLES turret damage.
	return 2.0 * pow(2.0, float(dmg_level))

func fire_rate() -> float:
	# Double Barrel — each level DOUBLES the rate of fire (capped for sanity).
	return minf(1.2 * pow(2.0, float(rate_level)), 24.0)

func multishot_targets() -> int:
	# Multishot — each level DOUBLES how many dots a turret hits per volley.
	return int(pow(2.0, float(multishot_level)))

# --- DRONE tree -------------------------------------------------------------
func drone_damage() -> float:
	# Plasma Core — each level DOUBLES drone damage.
	return 3.0 * pow(2.0, float(drone_dmg_level))

func drone_fire_rate() -> float:
	# Overclock — each level DOUBLES drone fire rate (capped for sanity).
	return minf(1.0 * pow(2.0, float(drone_rate_level)), 18.0)

# --- Costs ------------------------------------------------------------------
# Power doubles each level, so costs climb steeply to keep things earned.
func dmg_cost() -> int:
	return int(round(25.0 * pow(3.0, dmg_level)))

func rate_cost() -> int:
	return int(round(30.0 * pow(3.0, rate_level)))

func multishot_cost() -> int:
	return int(round(120.0 * pow(4.0, multishot_level)))

func cannon_cost() -> int:
	return int(round(50.0 * pow(1.8, float(cannon_count - 1))))

func drone_cost() -> int:
	return int(round(80.0 * pow(2.2, drone_count)))

func drone_rate_cost() -> int:
	return int(round(60.0 * pow(3.0, drone_rate_level)))

func drone_dmg_cost() -> int:
	return int(round(60.0 * pow(3.0, drone_dmg_level)))

func wall_cost() -> int:
	return int(round(25.0 * pow(1.5, wall_level)))


# ============================================================================
#  MAIN LOOP
# ============================================================================
func _process(delta: float) -> void:
	if slider != null:
		difficulty = slider.value

	if not game_over:
		elapsed += delta
		_handle_spawning(delta)
		_update_dots(delta)
		_update_cannons(delta)
		_update_drones(delta)
		_update_bullets(delta)

	_update_ui()


func _handle_spawning(delta: float) -> void:
	spawn_timer -= delta
	if spawn_timer <= 0.0:
		spawn_dot()
		# Spawns get faster over time and with higher difficulty.
		var interval := clampf(1.4 - elapsed * 0.01, 0.32, 1.4) / difficulty
		spawn_timer = interval


func _update_dots(delta: float) -> void:
	var i := dots.size() - 1
	while i >= 0:
		var d := dots[i]
		d.position.y += d.base_speed * difficulty * delta
		d.queue_redraw()
		if d.position.y >= WALL_Y:
			# Breach: bigger dots hit the wall harder.
			var dmg := maxi(1, int(ceil(d.max_hp / 6.0)))
			wall_hp -= dmg
			d.queue_free()
			dots.remove_at(i)
			if wall_hp <= 0:
				wall_hp = 0
				_trigger_game_over()
		i -= 1


func _update_cannons(delta: float) -> void:
	var shots := multishot_targets()
	for c in cannons:
		c.cooldown -= delta
		var targets := nearest_dots(c.position, shots)
		if targets.size() > 0:
			c.aim_angle = (targets[0].position - c.position).angle()
			if c.cooldown <= 0.0:
				# Multishot: one bullet at each of the nearest dots.
				for t in targets:
					fire_bullet(c.position, t, bullet_damage(),
						Color(1.0, 0.95, 0.45), Color(1.0, 0.7, 0.2, 0.5))
				c.cooldown = 1.0 / fire_rate()
		c.queue_redraw()


func _update_drones(delta: float) -> void:
	# Drones orbit a point above the wall, slowly rotating, and auto-fire.
	drone_orbit_phase += delta * 0.6
	var n := drones.size()
	for i in range(n):
		var dr := drones[i]
		var ang := drone_orbit_phase + TAU * float(i) / float(maxi(n, 1))
		dr.position = DRONE_CENTER + Vector2(cos(ang), sin(ang) * 0.45) * DRONE_ORBIT_RADIUS
		dr.cooldown -= delta
		var target := nearest_dot(dr.position)
		if target != null:
			dr.aim_angle = (target.position - dr.position).angle()
			if dr.cooldown <= 0.0:
				fire_bullet(dr.position, target, drone_damage(),
					Color(0.55, 1.0, 0.65), Color(0.3, 1.0, 0.5, 0.5))
				dr.cooldown = 1.0 / drone_fire_rate()
		dr.queue_redraw()


func _update_bullets(delta: float) -> void:
	var j := bullets.size() - 1
	while j >= 0:
		var b := bullets[j]
		b.position += b.velocity * delta
		b.queue_redraw()
		var remove := false

		if b.position.y < -30.0 or b.position.x < -30.0 or b.position.x > W + 30.0 or b.position.y > H + 30.0:
			remove = true
		else:
			var k := dots.size() - 1
			while k >= 0:
				var d := dots[k]
				if b.position.distance_to(d.position) <= d.radius + b.radius:
					d.hp -= b.damage
					d.queue_redraw()
					remove = true
					if d.hp <= 0.0:
						coins += d.reward
						kills += 1
						d.queue_free()
						dots.remove_at(k)
					break
				k -= 1

		if remove:
			b.queue_free()
			bullets.remove_at(j)
		j -= 1


# ============================================================================
#  ENTITY HELPERS
# ============================================================================
func spawn_dot() -> void:
	var tier := int(elapsed / 12.0)
	var hp := 3.0 + float(tier) * 2.5 + elapsed * 0.05
	var d := Dot.new()
	d.max_hp = hp
	d.hp = hp
	d.base_speed = 40.0 + elapsed * 0.22
	d.reward = 1 + tier
	d.radius = clampf(7.0 + hp * 0.12, 7.0, 22.0)
	d.color = _dot_color(tier)
	d.position = Vector2(randf_range(SPAWN_MARGIN, W - SPAWN_MARGIN), -24.0)
	add_child(d)
	dots.append(d)


func fire_bullet(from: Vector2, target: Dot, damage: float, core: Color, glow: Color) -> void:
	var dir := (target.position - from)
	if dir.length() < 0.001:
		dir = Vector2.UP
	var b := Bullet.new()
	b.position = from + dir.normalized() * 22.0
	b.velocity = dir.normalized() * BULLET_SPEED
	b.damage = damage
	b.core_color = core
	b.glow_color = glow
	add_child(b)
	bullets.append(b)


func nearest_dot(from: Vector2) -> Dot:
	var best: Dot = null
	var best_d := INF
	for d in dots:
		var dist := from.distance_squared_to(d.position)
		if dist < best_d:
			best_d = dist
			best = d
	return best


func nearest_dots(from: Vector2, count: int) -> Array[Dot]:
	# The `count` closest dots, nearest first. Used for turret multishot.
	var result: Array[Dot] = []
	if count <= 1 or dots.size() <= 1:
		var single := nearest_dot(from)
		if single != null:
			result.append(single)
		return result
	var sorted := dots.duplicate()
	sorted.sort_custom(func(a, b):
		return from.distance_squared_to(a.position) < from.distance_squared_to(b.position))
	for i in range(mini(count, sorted.size())):
		result.append(sorted[i])
	return result


func add_cannon() -> void:
	var c := Cannon.new()
	add_child(c)
	cannons.append(c)
	_reposition_cannons()


func add_drone() -> void:
	var dr := Drone.new()
	dr.position = DRONE_CENTER
	add_child(dr)
	drones.append(dr)


func _reposition_cannons() -> void:
	var n := cannons.size()
	for i in range(n):
		var x: float
		if n == 1:
			x = W / 2.0
		else:
			x = lerpf(130.0, W - 130.0, float(i) / float(n - 1))
		cannons[i].position = Vector2(x, CANNON_Y)


func _dot_color(tier: int) -> Color:
	var palette := [
		Color(0.92, 0.36, 0.36),  # red
		Color(0.96, 0.62, 0.27),  # orange
		Color(0.95, 0.86, 0.30),  # yellow
		Color(0.55, 0.85, 0.40),  # green
		Color(0.40, 0.78, 0.92),  # cyan
		Color(0.70, 0.55, 0.95),  # purple
	]
	return palette[tier % palette.size()]


# ============================================================================
#  UPGRADE HANDLERS
# ============================================================================
func _on_buy_dmg() -> void:
	var cost := dmg_cost()
	if coins >= cost:
		coins -= cost
		dmg_level += 1

func _on_buy_rate() -> void:
	var cost := rate_cost()
	if coins >= cost:
		coins -= cost
		rate_level += 1

func _on_buy_multishot() -> void:
	if multishot_level >= MAX_MULTISHOT_LEVEL:
		return
	var cost := multishot_cost()
	if coins >= cost:
		coins -= cost
		multishot_level += 1

func _on_buy_cannon() -> void:
	if cannon_count >= MAX_CANNONS:
		return
	var cost := cannon_cost()
	if coins >= cost:
		coins -= cost
		cannon_count += 1
		add_cannon()

func _on_buy_drone() -> void:
	if drone_count >= MAX_DRONES:
		return
	var cost := drone_cost()
	if coins >= cost:
		coins -= cost
		drone_count += 1
		add_drone()

func _on_buy_drone_rate() -> void:
	var cost := drone_rate_cost()
	if coins >= cost:
		coins -= cost
		drone_rate_level += 1

func _on_buy_drone_dmg() -> void:
	var cost := drone_dmg_cost()
	if coins >= cost:
		coins -= cost
		drone_dmg_level += 1

func _on_buy_wall() -> void:
	var cost := wall_cost()
	if coins >= cost:
		coins -= cost
		wall_level += 1
		wall_max_hp += 10
		wall_hp = wall_max_hp  # reinforcing fully repairs the wall


# ============================================================================
#  GAME OVER / RESTART
# ============================================================================
func _trigger_game_over() -> void:
	game_over = true
	go_label.text = "WALL BREACHED!\n\nWaves survived: %d\nDots destroyed: %d\nCoins banked: %d\n\nPress Restart to defend again." % [
		int(elapsed / 12.0), kills, coins
	]
	gameover_panel.visible = true


func _on_restart() -> void:
	for d in dots:
		d.queue_free()
	for b in bullets:
		b.queue_free()
	for c in cannons:
		c.queue_free()
	for dr in drones:
		dr.queue_free()
	dots.clear()
	bullets.clear()
	cannons.clear()
	drones.clear()

	elapsed = 0.0
	spawn_timer = 0.0
	coins = 0
	kills = 0
	dmg_level = 0
	rate_level = 0
	multishot_level = 0
	cannon_count = 1
	drone_count = 0
	drone_rate_level = 0
	drone_dmg_level = 0
	drone_orbit_phase = 0.0
	wall_level = 0
	wall_max_hp = START_WALL_HP
	wall_hp = START_WALL_HP
	game_over = false

	gameover_panel.visible = false
	add_cannon()


# ============================================================================
#  UI
# ============================================================================
func _build_ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)

	# --- Top difficulty/speed slider ---
	var bar := HBoxContainer.new()
	bar.position = Vector2(W / 2.0 - 280.0, 12.0)
	bar.custom_minimum_size = Vector2(560.0, 0.0)
	bar.add_theme_constant_override("separation", 12)
	ui.add_child(bar)

	var lbl := Label.new()
	lbl.text = "SPEED / DIFFICULTY"
	lbl.add_theme_font_size_override("font_size", 16)
	bar.add_child(lbl)

	slider = HSlider.new()
	slider.min_value = 0.5
	slider.max_value = 3.0
	slider.step = 0.1
	slider.value = 1.0
	slider.custom_minimum_size = Vector2(320.0, 22.0)
	slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(slider)

	diff_value_label = Label.new()
	diff_value_label.text = "1.0x"
	diff_value_label.custom_minimum_size = Vector2(48.0, 0.0)
	diff_value_label.add_theme_font_size_override("font_size", 16)
	bar.add_child(diff_value_label)

	# --- Stats (top-left) ---
	stats_label = Label.new()
	stats_label.position = Vector2(18.0, 14.0)
	stats_label.add_theme_font_size_override("font_size", 18)
	ui.add_child(stats_label)

	# --- Upgrade panel (right side) ---
	var panel := VBoxContainer.new()
	panel.position = Vector2(W - 250.0, 54.0)
	panel.custom_minimum_size = Vector2(234.0, 0.0)
	panel.add_theme_constant_override("separation", 5)
	ui.add_child(panel)

	_make_header(panel, "▼ TURRETS")
	btn_dmg = _make_button(panel, _on_buy_dmg)
	btn_rate = _make_button(panel, _on_buy_rate)
	btn_multishot = _make_button(panel, _on_buy_multishot)
	btn_cannon = _make_button(panel, _on_buy_cannon)

	_make_header(panel, "▼ DRONES")
	btn_drone = _make_button(panel, _on_buy_drone)
	btn_drone_rate = _make_button(panel, _on_buy_drone_rate)
	btn_drone_dmg = _make_button(panel, _on_buy_drone_dmg)

	_make_header(panel, "▼ DEFENSE")
	btn_wall = _make_button(panel, _on_buy_wall)

	# --- Game over panel ---
	gameover_panel = Panel.new()
	gameover_panel.size = Vector2(420.0, 260.0)
	gameover_panel.position = Vector2(W / 2.0 - 210.0, H / 2.0 - 130.0)
	gameover_panel.visible = false
	ui.add_child(gameover_panel)

	var gv := VBoxContainer.new()
	gv.position = Vector2(24.0, 24.0)
	gv.custom_minimum_size = Vector2(372.0, 212.0)
	gv.add_theme_constant_override("separation", 14)
	gameover_panel.add_child(gv)

	go_label = Label.new()
	go_label.add_theme_font_size_override("font_size", 18)
	go_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	gv.add_child(go_label)

	var restart_btn := Button.new()
	restart_btn.text = "RESTART"
	restart_btn.custom_minimum_size = Vector2(0.0, 44.0)
	restart_btn.add_theme_font_size_override("font_size", 20)
	restart_btn.pressed.connect(_on_restart)
	gv.add_child(restart_btn)


func _make_header(parent: Node, text: String) -> void:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", 15)
	lbl.add_theme_color_override("font_color", Color(0.65, 0.82, 1.0))
	parent.add_child(lbl)


func _make_button(parent: Node, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(0.0, 38.0)
	b.add_theme_font_size_override("font_size", 13)
	b.pressed.connect(handler)
	parent.add_child(b)
	return b


func _update_ui() -> void:
	diff_value_label.text = "%.1fx" % difficulty

	stats_label.text = "Coins: %d\nWall: %d / %d\nWave: %d\nKills: %d\nTurrets: %d   Drones: %d" % [
		coins, wall_hp, wall_max_hp, int(elapsed / 12.0) + 1, kills, cannon_count, drone_count
	]

	# --- Turret tree ---
	var dc := dmg_cost()
	btn_dmg.text = "Heavy Rounds  Lv.%d  ⟶ x2 dmg\n%.0f → %.0f dmg   [%dc]" % [
		dmg_level, bullet_damage(), bullet_damage() * 2.0, dc]
	btn_dmg.disabled = coins < dc

	var rc := rate_cost()
	btn_rate.text = "Double Barrel  Lv.%d  ⟶ x2 rate\n%.1f → %.1f /s   [%dc]" % [
		rate_level, fire_rate(), minf(fire_rate() * 2.0, 24.0), rc]
	btn_rate.disabled = coins < rc

	if multishot_level >= MAX_MULTISHOT_LEVEL:
		btn_multishot.text = "Multishot MAXED  (x%d targets)" % multishot_targets()
		btn_multishot.disabled = true
	else:
		var mc := multishot_cost()
		btn_multishot.text = "Multishot  Lv.%d  ⟶ x2 targets\nhits %d → %d dots   [%dc]" % [
			multishot_level, multishot_targets(), multishot_targets() * 2, mc]
		btn_multishot.disabled = coins < mc

	if cannon_count >= MAX_CANNONS:
		btn_cannon.text = "Turrets MAXED  (%d)" % MAX_CANNONS
		btn_cannon.disabled = true
	else:
		var cc := cannon_cost()
		btn_cannon.text = "Add Turret  (%d/%d)   [%dc]" % [cannon_count, MAX_CANNONS, cc]
		btn_cannon.disabled = coins < cc

	# --- Drone tree ---
	if drone_count >= MAX_DRONES:
		btn_drone.text = "Drones MAXED  (%d)" % MAX_DRONES
		btn_drone.disabled = true
	else:
		var drc := drone_cost()
		btn_drone.text = "Deploy Drone  (%d/%d)\n+1 orbiting gun   [%dc]" % [drone_count, MAX_DRONES, drc]
		btn_drone.disabled = coins < drc

	var drr := drone_rate_cost()
	btn_drone_rate.text = "Overclock  Lv.%d  ⟶ x2 rate\n%.1f → %.1f /s   [%dc]" % [
		drone_rate_level, drone_fire_rate(), minf(drone_fire_rate() * 2.0, 18.0), drr]
	btn_drone_rate.disabled = coins < drr or drone_count == 0

	var drd := drone_dmg_cost()
	btn_drone_dmg.text = "Plasma Core  Lv.%d  ⟶ x2 dmg\n%.0f → %.0f dmg   [%dc]" % [
		drone_dmg_level, drone_damage(), drone_damage() * 2.0, drd]
	btn_drone_dmg.disabled = coins < drd or drone_count == 0

	# --- Defense ---
	var wc := wall_cost()
	btn_wall.text = "Reinforce Wall  Lv.%d\n+10 HP, full repair   [%dc]" % [wall_level, wc]
	btn_wall.disabled = coins < wc


# ============================================================================
#  STATIC BACKGROUND (drawn beneath all entities)
# ============================================================================
func _draw() -> void:
	# Background
	draw_rect(Rect2(0, 0, W, H), Color(0.07, 0.08, 0.11))

	# Subtle vertical guide lines
	var x := 0.0
	while x <= W:
		draw_line(Vector2(x, 40.0), Vector2(x, WALL_Y), Color(1, 1, 1, 0.03), 1.0)
		x += 64.0

	# Danger zone near the wall
	draw_rect(Rect2(0, WALL_Y - 60.0, W, 60.0), Color(0.9, 0.2, 0.2, 0.05))

	# The wall / defense line
	draw_line(Vector2(0, WALL_Y), Vector2(W, WALL_Y), Color(0.85, 0.25, 0.25, 0.85), 4.0)

	# Ground beneath the wall where cannons sit
	draw_rect(Rect2(0, WALL_Y, W, H - WALL_Y), Color(0.11, 0.13, 0.18))
