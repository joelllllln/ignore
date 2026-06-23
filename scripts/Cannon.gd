extends Node2D
class_name Cannon

## A turret on the defense line. Aiming/firing is orchestrated by Main.

var cooldown: float = 0.0
var aim_angle: float = -PI / 2.0  # point straight up by default
var body_color: Color = Color(0.35, 0.72, 1.0)

func _draw() -> void:
	# Barrel (drawn first so the base sits on top of its root)
	var dir := Vector2.RIGHT.rotated(aim_angle)
	draw_line(Vector2.ZERO, dir * 24.0, Color(0.75, 0.82, 0.95), 7.0)
	draw_line(Vector2.ZERO, dir * 24.0, Color(0.9, 0.95, 1.0), 3.0)
	# Base ring
	draw_circle(Vector2.ZERO, 17.0, Color(0.15, 0.18, 0.26))
	draw_circle(Vector2.ZERO, 14.0, body_color)
	draw_circle(Vector2.ZERO, 6.0, Color(0.95, 0.98, 1.0))
