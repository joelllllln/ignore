extends Node2D
class_name Bullet

## A projectile fired by a cannon. Main moves it and checks collisions.

var velocity: Vector2 = Vector2.ZERO
var damage: float = 1.0
var radius: float = 4.0

func _draw() -> void:
	draw_circle(Vector2.ZERO, radius + 1.5, Color(1.0, 0.7, 0.2, 0.5))
	draw_circle(Vector2.ZERO, radius, Color(1.0, 0.95, 0.45))
	draw_circle(Vector2.ZERO, radius * 0.5, Color(1, 1, 1))
