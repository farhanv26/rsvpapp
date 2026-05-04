class ActivityItem {
  const ActivityItem({
    required this.id,
    required this.type,
    required this.description,
    required this.createdAt,
    required this.guestId,
    required this.guestName,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> json) => ActivityItem(
        id: json['id'] as String,
        type: json['type'] as String,
        description: json['description'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        guestId: json['guestId'] as String,
        guestName: json['guestName'] as String,
      );

  final String id;
  final String type;
  final String description;
  final DateTime createdAt;
  final String guestId;
  final String guestName;
}
