class AdminUser {
  const AdminUser({required this.id, required this.name, required this.role});

  factory AdminUser.fromJson(Map<String, dynamic> json) => AdminUser(
        id: json['id'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
      );

  final String id;
  final String name;
  final String role;

  bool get isSuperAdmin => role == 'super_admin';

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role};
}

/// Richer user model for the user-management list.
class ManagedUser {
  const ManagedUser({
    required this.id,
    required this.name,
    required this.role,
    required this.active,
    required this.createdAt,
    required this.eventCount,
  });

  factory ManagedUser.fromJson(Map<String, dynamic> json) => ManagedUser(
        id: json['id'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
        active: json['active'] as bool,
        createdAt: DateTime.parse(json['createdAt'] as String),
        eventCount: (json['eventCount'] as num).toInt(),
      );

  final String id;
  final String name;
  final String role;
  final bool active;
  final DateTime createdAt;
  final int eventCount;

  bool get isSuperAdmin => role == 'super_admin';
  String get roleLabel => role == 'super_admin' ? 'Super Admin' : 'Event Creator';
}

/// Deleted event summary for the trash/restore screen.
class DeletedEvent {
  const DeletedEvent({
    required this.id,
    required this.title,
    this.coupleNames,
    this.eventDate,
    this.venue,
    this.imagePath,
    required this.deletedAt,
    required this.createdAt,
    required this.guestCount,
  });

  factory DeletedEvent.fromJson(Map<String, dynamic> json) => DeletedEvent(
        id: json['id'] as String,
        title: json['title'] as String,
        coupleNames: json['coupleNames'] as String?,
        eventDate: json['eventDate'] != null ? DateTime.parse(json['eventDate'] as String) : null,
        venue: json['venue'] as String?,
        imagePath: json['imagePath'] as String?,
        deletedAt: DateTime.parse(json['deletedAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
        guestCount: (json['guestCount'] as num).toInt(),
      );

  final String id;
  final String title;
  final String? coupleNames;
  final DateTime? eventDate;
  final String? venue;
  final String? imagePath;
  final DateTime deletedAt;
  final DateTime createdAt;
  final int guestCount;

  String get displayName => coupleNames?.isNotEmpty == true ? coupleNames! : title;
}
