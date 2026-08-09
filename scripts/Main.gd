extends Node2D
## Idle Dot Shooter — main game manager.
##
## Dots spawn at the top of the screen and drift down toward the cannon line.
## Cannons auto-target and fire at the nearest dot. Killing dots awards coins,
## which are spent on upgrades. The slider at the top scales dot speed and
## spawn rate live. If too many dots breach the wall, it's game over.

# --- Layout constants -------------------------------------------------------
const DESIGN_SIZE := Vector2(1152.0, 648.0)  # fallback before the first refresh
const WALL_INSET: float = 60.0    # wall sits this far above the bottom edge
const CANNON_INSET: float = 42.0  # turrets sit just behind the wall
const CANNON_SIDE_INSET: float = 130.0
const SPAWN_MARGIN: float = 42.0
const SPAWN_OUTSET: float = 24.0  # dots appear this far beyond the top edge
const CULL_MARGIN: float = 30.0
const BULLET_SPEED: float = 640.0
const MAX_CANNONS: int = 10

# --- Playfield --------------------------------------------------------------
# The visible map, in this node's local coordinates. Recomputed from the
# viewport every frame so spawning, the wall and the cannon line follow the
# real map edges at any window size, stretch scale or camera zoom.
var field: Rect2 = Rect2(Vector2.ZERO, DESIGN_SIZE)

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
var ui_bar: HBoxContainer
var ui_panel: VBoxContainer


func _ready() -> void:
	randomize()
	_refresh_field()
	_build_ui()
	_layout_ui()
	add_cannon()  # start with one cannon
	get_viewport().size_changed.connect(_on_viewport_resized)
	queue_redraw()  # draw the static background/wall once


func _on_viewport_resized() -> void:
	_refresh_field()
	_layout_ui()
	_reposition_cannons()
	queue_redraw()


# ============================================================================
#  PLAYFIELD
# ============================================================================
## Recompute the visible map in local coordinates.
##
## The viewport's visible rect is in screen space; the inverse canvas transform
## folds in window stretch, any scale on this node and a Camera2D's zoom/pan,
## so the result is always the actual map the player is looking at.
func _refresh_field() -> void:
	var vp := get_viewport()
	if vp == null:
		return
	var vr := vp.get_visible_rect()
	var screen_to_local := get_global_transform_with_canvas().affine_inverse()
	var corners := [
		screen_to_local * vr.position,
		screen_to_local * Vector2(vr.end.x, vr.position.y),
		screen_to_local * vr.end,
		screen_to_local * Vector2(vr.position.x, vr.end.y),
	]
	var top_left: Vector2 = corners[0]
	var bottom_right: Vector2 = corners[0]
	for c: Vector2 in corners:
		top_left = top_left.min(c)
		bottom_right = bottom_right.max(c)
	var size := bottom_right - top_left
	if size.x < 1.0 or size.y < 1.0:
		return  # degenerate (minimised window); keep the last good field
	field = Rect2(top_left, size)


func wall_y() -> float:
	return field.end.y - WALL_INSET


func cannon_y() -> float:
	return field.end.y - CANNON_INSET


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

	# Track the map every frame: zoom/resize can change between resize signals.
	var prev_field := field
	_refresh_field()
	if not field.is_equal_approx(prev_field):
		_reposition_cannons()
		queue_redraw()

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
		if d.position.y >= wall_y():
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

		if not field.grow(CULL_MARGIN).has_point(b.position):
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
	# Always along the top edge of the *visible* map, whatever the zoom.
	var margin := minf(SPAWN_MARGIN, field.size.x * 0.25)
	d.position = Vector2(
		randf_range(field.position.x + margin, field.end.x - margin),
		field.position.y - SPAWN_OUTSET
	)
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
	var inset := minf(CANNON_SIDE_INSET, field.size.x * 0.2)
	for i in range(n):
		var x: float
		if n == 1:
			x = field.get_center().x
		else:
			x = lerpf(field.position.x + inset, field.end.x - inset, float(i) / float(n - 1))
		cannons[i].position = Vector2(x, cannon_y())


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
	ui_bar = bar
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
	ui_panel = panel
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


## Anchor the UI to the real viewport, which is screen space for a CanvasLayer
## and so is independent of the world field above.
func _layout_ui() -> void:
	if ui_bar == null:
		return
	var vs := get_viewport().get_visible_rect().size
	ui_bar.position = Vector2(vs.x / 2.0 - 280.0, 12.0)
	ui_panel.position = Vector2(vs.x - 250.0, 70.0)
	gameover_panel.position = (vs - gameover_panel.size) / 2.0


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
	var wy := wall_y()

	# Background
	draw_rect(field, Color(0.07, 0.08, 0.11))

	# Subtle vertical guide lines
	var x := field.position.x
	while x <= field.end.x:
		draw_line(Vector2(x, field.position.y + 40.0), Vector2(x, wy), Color(1, 1, 1, 0.03), 1.0)
		x += 64.0

	# Danger zone near the wall
	draw_rect(Rect2(field.position.x, wy - 60.0, field.size.x, 60.0), Color(0.9, 0.2, 0.2, 0.05))

	# The wall / defense line
	draw_line(Vector2(field.position.x, wy), Vector2(field.end.x, wy), Color(0.85, 0.25, 0.25, 0.85), 4.0)

	# Ground beneath the wall where cannons sit
	draw_rect(Rect2(field.position.x, wy, field.size.x, field.end.y - wy), Color(0.11, 0.13, 0.18))
