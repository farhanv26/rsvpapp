class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    required this.entityType,
    required this.entityId,
    this.eventId,
    required this.read,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        entityType: json['entityType'] as String,
        entityId: json['entityId'] as String,
        eventId: json['eventId'] as String?,
        read: json['read'] as bool,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String type;
  final String title;
  final String? description;
  final String entityType;
  final String entityId;
  final String? eventId;
  final bool read;
  final DateTime createdAt;
}
