extends Node2D
class_name Dot

## A descending enemy "dot". Movement and collision are driven by Main;
## this node only stores its stats and draws itself.

var max_hp: float = 3.0
var hp: float = 3.0
var base_speed: float = 45.0
var radius: float = 9.0
var color: Color = Color(0.9, 0.3, 0.3)
var reward: int = 1

func _draw() -> void:
	# Body
	draw_circle(Vector2.ZERO, radius, color)
	# Darker outline for readability
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 28, Color(0, 0, 0, 0.45), 2.0, true)
	# Small highlight
	draw_circle(Vector2(-radius * 0.3, -radius * 0.3), radius * 0.28, Color(1, 1, 1, 0.35))
	# Health ring (only when damaged)
	var frac := clampf(hp / maxf(max_hp, 0.001), 0.0, 1.0)
	if frac < 0.999:
		draw_arc(Vector2.ZERO, radius + 4.0, -PI / 2.0, -PI / 2.0 + TAU * frac, 28, Color(0.45, 1.0, 0.55), 2.5, true)
