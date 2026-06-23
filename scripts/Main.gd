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

# --- Runtime state ----------------------------------------------------------
var difficulty: float = 1.0
var elapsed: float = 0.0
var spawn_timer: float = 0.0

var coins: int = 0
var kills: int = 0
var wall_hp: int = START_WALL_HP
var wall_max_hp: int = START_WALL_HP
var game_over: bool = false

# Upgrade levels
var dmg_level: int = 0
var rate_level: int = 0
var cannon_count: int = 1
var wall_level: int = 0

# Entity pools (children of this node)
var dots: Array[Dot] = []
var bullets: Array[Bullet] = []
var cannons: Array[Cannon] = []

# --- UI references ----------------------------------------------------------
var slider: HSlider
var diff_value_label: Label
var stats_label: Label
var btn_dmg: Button
var btn_rate: Button
var btn_cannon: Button
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
func bullet_damage() -> float:
	return 2.0 + float(dmg_level) * 1.5

func fire_rate() -> float:
	# shots per second, capped so it stays sane
	return minf(1.2 + float(rate_level) * 0.25, 14.0)

func dmg_cost() -> int:
	return int(round(15.0 * pow(1.5, dmg_level)))

func rate_cost() -> int:
	return int(round(20.0 * pow(1.55, rate_level)))

func cannon_cost() -> int:
	return int(round(50.0 * pow(1.8, float(cannon_count - 1))))

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
	for c in cannons:
		c.cooldown -= delta
		var target := nearest_dot(c.position)
		if target != null:
			c.aim_angle = (target.position - c.position).angle()
			if c.cooldown <= 0.0:
				fire_bullet(c, target)
				c.cooldown = 1.0 / fire_rate()
		c.queue_redraw()


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


func fire_bullet(cannon: Cannon, target: Dot) -> void:
	var b := Bullet.new()
	b.position = cannon.position + Vector2.RIGHT.rotated(cannon.aim_angle) * 24.0
	var dir := (target.position - b.position)
	if dir.length() < 0.001:
		dir = Vector2.UP
	b.velocity = dir.normalized() * BULLET_SPEED
	b.damage = bullet_damage()
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


func add_cannon() -> void:
	var c := Cannon.new()
	add_child(c)
	cannons.append(c)
	_reposition_cannons()


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

func _on_buy_cannon() -> void:
	if cannon_count >= MAX_CANNONS:
		return
	var cost := cannon_cost()
	if coins >= cost:
		coins -= cost
		cannon_count += 1
		add_cannon()

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
	dots.clear()
	bullets.clear()
	cannons.clear()

	elapsed = 0.0
	spawn_timer = 0.0
	coins = 0
	kills = 0
	dmg_level = 0
	rate_level = 0
	cannon_count = 1
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
	panel.position = Vector2(W - 250.0, 70.0)
	panel.custom_minimum_size = Vector2(234.0, 0.0)
	panel.add_theme_constant_override("separation", 8)
	ui.add_child(panel)

	var title := Label.new()
	title.text = "— UPGRADES —"
	title.add_theme_font_size_override("font_size", 16)
	panel.add_child(title)

	btn_dmg = _make_button(panel, _on_buy_dmg)
	btn_rate = _make_button(panel, _on_buy_rate)
	btn_cannon = _make_button(panel, _on_buy_cannon)
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


func _make_button(parent: Node, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(0.0, 40.0)
	b.add_theme_font_size_override("font_size", 15)
	b.pressed.connect(handler)
	parent.add_child(b)
	return b


func _update_ui() -> void:
	diff_value_label.text = "%.1fx" % difficulty

	stats_label.text = "Coins: %d\nWall: %d / %d\nWave: %d\nKills: %d\nCannons: %d" % [
		coins, wall_hp, wall_max_hp, int(elapsed / 12.0) + 1, kills, cannon_count
	]

	var dc := dmg_cost()
	btn_dmg.text = "⬆ Damage  Lv.%d\n(%.1f → %.1f)  [%dc]" % [dmg_level, bullet_damage(), bullet_damage() + 1.5, dc]
	btn_dmg.disabled = coins < dc

	var rc := rate_cost()
	btn_rate.text = "⬆ Fire Rate  Lv.%d\n(%.2f/s)  [%dc]" % [rate_level, fire_rate(), rc]
	btn_rate.disabled = coins < rc

	if cannon_count >= MAX_CANNONS:
		btn_cannon.text = "Cannons MAXED (%d)" % MAX_CANNONS
		btn_cannon.disabled = true
	else:
		var cc := cannon_cost()
		btn_cannon.text = "➕ Add Cannon  (%d/%d)\n[%dc]" % [cannon_count, MAX_CANNONS, cc]
		btn_cannon.disabled = coins < cc

	var wc := wall_cost()
	btn_wall.text = "🛡 Reinforce Wall  Lv.%d\n(+10 HP, full repair)  [%dc]" % [wall_level, wc]
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
