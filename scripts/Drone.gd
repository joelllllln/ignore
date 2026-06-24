extends Node2D
class_name Drone

## An autonomous combat drone that orbits above the wall and fires at dots.
## Movement, targeting and firing are orchestrated by Main; this node only
## stores its state and draws itself.

var cooldown: float = 0.0
var aim_angle: float = -PI / 2.0
var body_color: Color = Color(0.45, 1.0, 0.70)

func _draw() -> void:
	# Twin barrels pointing at the current target
	var dir := Vector2.RIGHT.rotated(aim_angle)
	var perp := dir.orthogonal()
	draw_line(perp * 5.0, perp * 5.0 + dir * 16.0, Color(0.8, 1.0, 0.9), 3.0)
	draw_line(-perp * 5.0, -perp * 5.0 + dir * 16.0, Color(0.8, 1.0, 0.9), 3.0)
	# Hull — a small rounded diamond
	var pts := PackedVector2Array([
		Vector2(0, -11), Vector2(9, 0), Vector2(0, 11), Vector2(-9, 0),
	])
	draw_colored_polygon(pts, body_color)
	draw_polyline(PackedVector2Array([
		Vector2(0, -11), Vector2(9, 0), Vector2(0, 11), Vector2(-9, 0), Vector2(0, -11),
	]), Color(0.1, 0.25, 0.18), 2.0)
	# Glowing core
	draw_circle(Vector2.ZERO, 3.5, Color(0.9, 1.0, 0.95))
