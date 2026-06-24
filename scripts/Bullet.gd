extends Node2D
class_name Bullet

## A projectile fired by a cannon or drone. Main moves it and checks collisions.

var velocity: Vector2 = Vector2.ZERO
var damage: float = 1.0
var radius: float = 4.0
var core_color: Color = Color(1.0, 0.95, 0.45)
var glow_color: Color = Color(1.0, 0.7, 0.2, 0.5)

func _draw() -> void:
	draw_circle(Vector2.ZERO, radius + 1.5, glow_color)
	draw_circle(Vector2.ZERO, radius, core_color)
	draw_circle(Vector2.ZERO, radius * 0.5, Color(1, 1, 1))
