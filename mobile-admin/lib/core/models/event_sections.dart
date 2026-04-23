class EventSections {
  const EventSections({
    required this.followUp,
    required this.readiness,
    required this.listHygiene,
    required this.communications,
    required this.rsvpDeadline,
  });

  factory EventSections.fromJson(Map<String, dynamic> json) => EventSections(
        followUp: FollowUpSection.fromJson(json['followUp'] as Map<String, dynamic>),
        readiness: ReadinessSection.fromJson(json['readiness'] as Map<String, dynamic>),
        listHygiene: ListHygieneSection.fromJson(json['listHygiene'] as Map<String, dynamic>),
        communications: CommunicationsSection.fromJson(json['communications'] as Map<String, dynamic>),
        rsvpDeadline: RsvpDeadlineSection.fromJson(json['rsvpDeadline'] as Map<String, dynamic>),
      );

  final FollowUpSection followUp;
  final ReadinessSection readiness;
  final ListHygieneSection listHygiene;
  final CommunicationsSection communications;
  final RsvpDeadlineSection rsvpDeadline;
}

class FollowUpSection {
  const FollowUpSection({required this.awaitingRsvp});
  factory FollowUpSection.fromJson(Map<String, dynamic> j) =>
      FollowUpSection(awaitingRsvp: (j['awaitingRsvp'] as num).toInt());
  final int awaitingRsvp;
}

class ReadinessSection {
  const ReadinessSection({
    required this.readyToSend,
    required this.missingContact,
    required this.alreadyInvited,
    required this.responded,
  });
  factory ReadinessSection.fromJson(Map<String, dynamic> j) => ReadinessSection(
        readyToSend: (j['readyToSend'] as num).toInt(),
        missingContact: (j['missingContact'] as num).toInt(),
        alreadyInvited: (j['alreadyInvited'] as num).toInt(),
        responded: (j['responded'] as num).toInt(),
      );
  final int readyToSend;
  final int missingContact;
  final int alreadyInvited;
  final int responded;
}

class ListHygieneSection {
  const ListHygieneSection({
    required this.possibleDuplicates,
    required this.duplicateClusters,
    required this.missingContact,
    required this.sendReady,
  });
  factory ListHygieneSection.fromJson(Map<String, dynamic> j) => ListHygieneSection(
        possibleDuplicates: (j['possibleDuplicates'] as num).toInt(),
        duplicateClusters: (j['duplicateClusters'] as num).toInt(),
        missingContact: (j['missingContact'] as num).toInt(),
        sendReady: (j['sendReady'] as num).toInt(),
      );
  final int possibleDuplicates;
  final int duplicateClusters;
  final int missingContact;
  final int sendReady;
}

class CommunicationsSection {
  const CommunicationsSection({
    required this.totalLogs,
    required this.recentLogs,
    required this.guestsWithLogs,
    required this.guestsWithoutLogs,
  });
  factory CommunicationsSection.fromJson(Map<String, dynamic> j) => CommunicationsSection(
        totalLogs: (j['totalLogs'] as num).toInt(),
        recentLogs: (j['recentLogs'] as num).toInt(),
        guestsWithLogs: (j['guestsWithLogs'] as num).toInt(),
        guestsWithoutLogs: (j['guestsWithoutLogs'] as num).toInt(),
      );
  final int totalLogs;
  final int recentLogs;
  final int guestsWithLogs;
  final int guestsWithoutLogs;
}

class RsvpDeadlineSection {
  const RsvpDeadlineSection({required this.deadline, required this.status});
  factory RsvpDeadlineSection.fromJson(Map<String, dynamic> j) => RsvpDeadlineSection(
        deadline: j['deadline'] != null ? DateTime.parse(j['deadline'] as String) : null,
        status: j['status'] as String,
      );
  final DateTime? deadline;
  final String status; // "none" | "open" | "closing_soon" | "closes_today" | "closed"

  bool get isClosed => status == 'closed';
  bool get isClosingSoon => status == 'closing_soon' || status == 'closes_today';
  bool get isUrgent => status == 'closes_today';
}

class CommunicationLog {
  const CommunicationLog({
    required this.id,
    required this.channel,
    required this.actionKey,
    required this.label,
    this.detail,
    required this.success,
    this.actorName,
    required this.createdAt,
  });

  factory CommunicationLog.fromJson(Map<String, dynamic> json) => CommunicationLog(
        id: json['id'] as String,
        channel: json['channel'] as String,
        actionKey: json['actionKey'] as String,
        label: json['label'] as String,
        detail: json['detail'] as String?,
        success: json['success'] as bool? ?? true,
        actorName: json['actorName'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String channel;
  final String actionKey;
  final String label;
  final String? detail;
  final bool success;
  final String? actorName;
  final DateTime createdAt;
}
