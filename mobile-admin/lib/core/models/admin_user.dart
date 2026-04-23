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
