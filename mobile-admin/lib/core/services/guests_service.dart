import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/event_sections.dart';
import '../models/guest.dart';

final guestsServiceProvider =
    Provider<GuestsService>((ref) => GuestsService(ref.watch(apiClientProvider)));

class GuestListParams {
  const GuestListParams({
    required this.eventId,
    this.query = '',
    this.status = 'all',
    this.readiness = 'all',
    this.followup = false,
    this.duplicate = 'all',
    this.sort = 'name_asc',
  });

  final String eventId;
  final String query;
  final String status;
  final String readiness;
  final bool followup;
  final String duplicate;
  final String sort;

  GuestListParams copyWith({
    String? query,
    String? status,
    String? readiness,
    bool? followup,
    String? duplicate,
    String? sort,
  }) =>
      GuestListParams(
        eventId: eventId,
        query: query ?? this.query,
        status: status ?? this.status,
        readiness: readiness ?? this.readiness,
        followup: followup ?? this.followup,
        duplicate: duplicate ?? this.duplicate,
        sort: sort ?? this.sort,
      );

  @override
  bool operator ==(Object other) =>
      other is GuestListParams &&
      other.eventId == eventId &&
      other.query == query &&
      other.status == status &&
      other.readiness == readiness &&
      other.followup == followup &&
      other.duplicate == duplicate &&
      other.sort == sort;

  @override
  int get hashCode =>
      Object.hash(eventId, query, status, readiness, followup, duplicate, sort);
}

final guestsListProvider =
    FutureProvider.family<List<Guest>, GuestListParams>((ref, params) async {
  return ref.watch(guestsServiceProvider).listGuests(params: params);
});

final eventSectionsProvider =
    FutureProvider.family<EventSections, String>((ref, eventId) async {
  return ref.watch(guestsServiceProvider).getEventSections(eventId);
});

class GuestsService {
  const GuestsService(this._client);

  final ApiClient _client;

  Future<List<Guest>> listGuests({
    required GuestListParams params,
    int page = 1,
    int limit = 200,
  }) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '/events/${params.eventId}/guests',
        queryParameters: {
          if (params.query.isNotEmpty) 'q': params.query,
          if (params.status != 'all') 'status': params.status,
          if (params.readiness != 'all') 'readiness': params.readiness,
          if (params.followup) 'followup': '1',
          if (params.duplicate != 'all') 'duplicate': params.duplicate,
          if (params.sort != 'name_asc') 'sort': params.sort,
          'page': page,
          'limit': limit,
        },
      );
      final list = res.data!['guests'] as List<dynamic>;
      return list.map((e) => Guest.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EventSections> getEventSections(String eventId) async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/events/$eventId/sections');
      return EventSections.fromJson(res.data!);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markInvited(
    String eventId,
    String guestId, {
    String channel = 'manual',
  }) async {
    try {
      await _client.post<void>(
        '/events/$eventId/guests/$guestId/mark-invited',
        data: {'channel': channel},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markUninvited(String eventId, String guestId) async {
    try {
      await _client.post<void>('/events/$eventId/guests/$guestId/mark-uninvited');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> recordRsvp(
    String eventId,
    String guestId, {
    required bool attending,
    int? attendingCount,
    String? notes,
  }) async {
    try {
      await _client.post<void>(
        '/events/$eventId/guests/$guestId/record-rsvp',
        data: {
          'attending': attending,
          if (attendingCount != null) 'attendingCount': attendingCount,
          if (notes != null) 'notes': notes,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Guest> createGuest(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await _client.post<Map<String, dynamic>>(
        '/events/$eventId/guests',
        data: data,
      );
      return Guest.fromJson(res.data!['guest'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Guest> updateGuest(
    String eventId,
    String guestId,
    Map<String, dynamic> data,
  ) async {
    try {
      final res = await _client.put<Map<String, dynamic>>(
        '/events/$eventId/guests/$guestId',
        data: data,
      );
      return Guest.fromJson(res.data!['guest'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteGuest(String eventId, String guestId) async {
    try {
      await _client.delete<void>('/events/$eventId/guests/$guestId');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<CommunicationLog>> getCommunicationHistory(
    String eventId,
    String guestId,
  ) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '/events/$eventId/guests/$guestId/communication-history',
      );
      final logs = res.data!['logs'] as List<dynamic>;
      return logs
          .map((e) => CommunicationLog.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
