class Event {
  const Event({
    required this.id,
    required this.title,
    required this.slug,
    this.coupleNames,
    this.eventDate,
    this.rsvpDeadline,
    this.eventTime,
    this.venue,
    required this.theme,
    this.imagePath,
    required this.createdAt,
    required this.guestCount,
    required this.familyCount,
    required this.totalHeadcount,
    required this.responded,
    required this.attendingFamilies,
    required this.confirmedAttendees,
    required this.pendingFamilies,
  });

  factory Event.fromJson(Map<String, dynamic> json) => Event(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String,
        coupleNames: json['coupleNames'] as String?,
        eventDate: json['eventDate'] != null ? DateTime.parse(json['eventDate'] as String) : null,
        rsvpDeadline: json['rsvpDeadline'] != null ? DateTime.parse(json['rsvpDeadline'] as String) : null,
        eventTime: json['eventTime'] as String?,
        venue: json['venue'] as String?,
        theme: json['theme'] as String,
        imagePath: json['imagePath'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        guestCount: (json['guestCount'] as num? ?? 0).toInt(),
        familyCount: (json['familyCount'] as num? ?? json['guestCount'] as num? ?? 0).toInt(),
        totalHeadcount: (json['totalHeadcount'] as num? ?? 0).toInt(),
        responded: (json['responded'] as num? ?? 0).toInt(),
        attendingFamilies: (json['attendingFamilies'] as num? ?? 0).toInt(),
        confirmedAttendees: (json['confirmedAttendees'] as num? ?? 0).toInt(),
        pendingFamilies: (json['pendingFamilies'] as num? ?? 0).toInt(),
      );

  final String id;
  final String title;
  final String slug;
  final String? coupleNames;
  final DateTime? eventDate;
  final DateTime? rsvpDeadline;
  final String? eventTime;
  final String? venue;
  final String theme;
  final String? imagePath;
  final DateTime createdAt;
  // Guest counts
  final int guestCount;       // raw record count (= familyCount)
  final int familyCount;      // families (same as guestCount, explicitly labelled)
  final int totalHeadcount;   // sum of all people across all family records
  final int responded;        // families that submitted an RSVP
  final int attendingFamilies;
  final int confirmedAttendees; // headcount of attending guests
  final int pendingFamilies;    // invited but not yet responded

  String get displayName => coupleNames?.isNotEmpty == true ? coupleNames! : title;
  int get responseRate => familyCount > 0 ? ((responded / familyCount) * 100).round() : 0;
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

class ItineraryItem {
  const ItineraryItem({
    this.startTime,
    this.time,
    this.endTime,
    required this.title,
    this.icon,
    this.description,
  });

  factory ItineraryItem.fromJson(Map<String, dynamic> json) => ItineraryItem(
        startTime: json['startTime'] as String?,
        time: json['time'] as String?,
        endTime: json['endTime'] as String?,
        title: json['title'] as String? ?? '',
        icon: json['icon'] as String?,
        description: json['description'] as String?,
      );

  Map<String, dynamic> toJson() => {
        if (startTime != null) 'startTime': startTime,
        if (time != null) 'time': time,
        if (endTime != null) 'endTime': endTime,
        'title': title,
        if (icon != null) 'icon': icon,
        if (description != null) 'description': description,
      };

  final String? startTime;
  final String? time;
  final String? endTime;
  final String title;
  final String? icon;
  final String? description;

  String get displayTime {
    final start = startTime ?? time ?? '';
    if (start.isEmpty) return '';
    return endTime != null ? '$start – $endTime' : start;
  }
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
    required this.itinerary,
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
        itinerary: (json['itinerary'] as List<dynamic>? ?? [])
            .where((e) => e is Map)
            .map((e) => ItineraryItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
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
  final List<ItineraryItem> itinerary;
  final DateTime createdAt;

  String get displayName => coupleNames?.isNotEmpty == true ? coupleNames! : title;
}
