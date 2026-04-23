class Event {
  const Event({
    required this.id,
    required this.title,
    required this.slug,
    this.coupleNames,
    this.eventDate,
    this.venue,
    required this.theme,
    required this.createdAt,
    required this.guestCount,
  });

  factory Event.fromJson(Map<String, dynamic> json) => Event(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String,
        coupleNames: json['coupleNames'] as String?,
        eventDate: json['eventDate'] != null ? DateTime.parse(json['eventDate'] as String) : null,
        venue: json['venue'] as String?,
        theme: json['theme'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        guestCount: (json['guestCount'] as num).toInt(),
      );

  final String id;
  final String title;
  final String slug;
  final String? coupleNames;
  final DateTime? eventDate;
  final String? venue;
  final String theme;
  final DateTime createdAt;
  final int guestCount;

  String get displayName => coupleNames?.isNotEmpty == true ? coupleNames! : title;
}

class EventStats {
  const EventStats({
    required this.totalFamilies,
    required this.countedFamilies,
    required this.totalMaxInvited,
    required this.totalMen,
    required this.totalWomen,
    required this.totalKids,
    required this.invitedFamilies,
    required this.notInvitedCount,
    required this.totalResponded,
    required this.totalPending,
    required this.awaitingRsvpCount,
    required this.attendingFamilies,
    required this.declinedFamilies,
    required this.confirmedAttendees,
    required this.responseRate,
  });

  factory EventStats.fromJson(Map<String, dynamic> json) => EventStats(
        totalFamilies: (json['totalFamilies'] as num).toInt(),
        countedFamilies: (json['countedFamilies'] as num).toInt(),
        totalMaxInvited: (json['totalMaxInvited'] as num).toInt(),
        totalMen: (json['totalMen'] as num).toInt(),
        totalWomen: (json['totalWomen'] as num).toInt(),
        totalKids: (json['totalKids'] as num).toInt(),
        invitedFamilies: (json['invitedFamilies'] as num).toInt(),
        notInvitedCount: (json['notInvitedCount'] as num).toInt(),
        totalResponded: (json['totalResponded'] as num).toInt(),
        totalPending: (json['totalPending'] as num).toInt(),
        awaitingRsvpCount: (json['awaitingRsvpCount'] as num).toInt(),
        attendingFamilies: (json['attendingFamilies'] as num).toInt(),
        declinedFamilies: (json['declinedFamilies'] as num).toInt(),
        confirmedAttendees: (json['confirmedAttendees'] as num).toInt(),
        responseRate: (json['responseRate'] as num).toInt(),
      );

  final int totalFamilies;
  final int countedFamilies;
  final int totalMaxInvited;
  final int totalMen;
  final int totalWomen;
  final int totalKids;
  final int invitedFamilies;
  final int notInvitedCount;
  final int totalResponded;
  final int totalPending;
  final int awaitingRsvpCount;
  final int attendingFamilies;
  final int declinedFamilies;
  final int confirmedAttendees;
  final int responseRate;
}

class EventDetail {
  const EventDetail({required this.event, required this.stats});
  factory EventDetail.fromJson(Map<String, dynamic> json) => EventDetail(
        event: EventDetailInfo.fromJson(json['event'] as Map<String, dynamic>),
        stats: EventStats.fromJson(json['stats'] as Map<String, dynamic>),
      );

  final EventDetailInfo event;
  final EventStats stats;
}

class EventDetailInfo {
  const EventDetailInfo({
    required this.id,
    required this.title,
    required this.slug,
    this.coupleNames,
    this.eventSubtitle,
    this.eventDate,
    this.rsvpDeadline,
    this.eventTime,
    this.venue,
    required this.theme,
    this.description,
    this.imagePath,
    required this.createdAt,
  });

  factory EventDetailInfo.fromJson(Map<String, dynamic> json) => EventDetailInfo(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String,
        coupleNames: json['coupleNames'] as String?,
        eventSubtitle: json['eventSubtitle'] as String?,
        eventDate: json['eventDate'] != null ? DateTime.parse(json['eventDate'] as String) : null,
        rsvpDeadline: json['rsvpDeadline'] != null ? DateTime.parse(json['rsvpDeadline'] as String) : null,
        eventTime: json['eventTime'] as String?,
        venue: json['venue'] as String?,
        theme: json['theme'] as String,
        description: json['description'] as String?,
        imagePath: json['imagePath'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String title;
  final String slug;
  final String? coupleNames;
  final String? eventSubtitle;
  final DateTime? eventDate;
  final DateTime? rsvpDeadline;
  final String? eventTime;
  final String? venue;
  final String theme;
  final String? description;
  final String? imagePath;
  final DateTime createdAt;

  String get displayName => coupleNames?.isNotEmpty == true ? coupleNames! : title;
}
