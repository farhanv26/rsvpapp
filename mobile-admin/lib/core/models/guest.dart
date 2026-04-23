class Guest {
  const Guest({
    required this.id,
    required this.guestName,
    required this.greeting,
    required this.menCount,
    required this.womenCount,
    required this.kidsCount,
    required this.maxGuests,
    this.attending,
    this.attendingCount,
    this.respondedAt,
    this.invitedAt,
    this.inviteChannelLastUsed,
    required this.inviteCount,
    this.lastReminderAt,
    this.phone,
    this.phoneCountryCode,
    this.email,
    this.group,
    this.tableName,
    this.notes,
    this.hostMessage,
    required this.isFamilyInvite,
    required this.excludeFromTotals,
    this.excludeReason,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Guest.fromJson(Map<String, dynamic> json) => Guest(
        id: json['id'] as String,
        guestName: json['guestName'] as String,
        greeting: json['greeting'] as String,
        menCount: (json['menCount'] as num).toInt(),
        womenCount: (json['womenCount'] as num).toInt(),
        kidsCount: (json['kidsCount'] as num).toInt(),
        maxGuests: (json['maxGuests'] as num).toInt(),
        attending: json['attending'] as bool?,
        attendingCount: json['attendingCount'] != null ? (json['attendingCount'] as num).toInt() : null,
        respondedAt: json['respondedAt'] != null ? DateTime.parse(json['respondedAt'] as String) : null,
        invitedAt: json['invitedAt'] != null ? DateTime.parse(json['invitedAt'] as String) : null,
        inviteChannelLastUsed: json['inviteChannelLastUsed'] as String?,
        inviteCount: (json['inviteCount'] as num).toInt(),
        lastReminderAt: json['lastReminderAt'] != null ? DateTime.parse(json['lastReminderAt'] as String) : null,
        phone: json['phone'] as String?,
        phoneCountryCode: json['phoneCountryCode'] as String?,
        email: json['email'] as String?,
        group: json['group'] as String?,
        tableName: json['tableName'] as String?,
        notes: json['notes'] as String?,
        hostMessage: json['hostMessage'] as String?,
        isFamilyInvite: json['isFamilyInvite'] as bool,
        excludeFromTotals: json['excludeFromTotals'] as bool,
        excludeReason: json['excludeReason'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );

  final String id;
  final String guestName;
  final String greeting;
  final int menCount;
  final int womenCount;
  final int kidsCount;
  final int maxGuests;
  final bool? attending;
  final int? attendingCount;
  final DateTime? respondedAt;
  final DateTime? invitedAt;
  final String? inviteChannelLastUsed;
  final int inviteCount;
  final DateTime? lastReminderAt;
  final String? phone;
  final String? phoneCountryCode;
  final String? email;
  final String? group;
  final String? tableName;
  final String? notes;
  final String? hostMessage;
  final bool isFamilyInvite;
  final bool excludeFromTotals;
  final String? excludeReason;
  final DateTime createdAt;
  final DateTime updatedAt;

  int get totalCount {
    final sum = menCount + womenCount + kidsCount;
    return sum > 0 ? sum : maxGuests;
  }

  String? get fullPhone {
    if (phone == null) return null;
    if (phoneCountryCode != null) return '$phoneCountryCode$phone';
    return phone;
  }

  String get fullPhoneDigits {
    if (phone == null) return '';
    final cc = phoneCountryCode ?? '';
    return '$cc$phone'.replaceAll(RegExp(r'\D'), '');
  }

  GuestStatus get status {
    if (respondedAt != null) {
      if (attending == true) return GuestStatus.attending;
      if (attending == false) return GuestStatus.declined;
    }
    if (invitedAt != null) return GuestStatus.invited;
    return GuestStatus.notInvited;
  }

  bool get hasContact => phone != null || email != null;
}

enum GuestStatus { attending, declined, invited, notInvited }
