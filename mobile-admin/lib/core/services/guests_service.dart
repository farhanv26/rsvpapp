import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/guest.dart';

final guestsServiceProvider = Provider<GuestsService>((ref) => GuestsService(ref.watch(apiClientProvider)));

class GuestListParams {
  const GuestListParams({required this.eventId, this.query = '', this.status = 'all'});
  final String eventId;
  final String query;
  final String status;

  @override
  bool operator ==(Object other) =>
      other is GuestListParams && other.eventId == eventId && other.query == query && other.status == status;

  @override
  int get hashCode => Object.hash(eventId, query, status);
}

final guestsListProvider = FutureProvider.family<List<Guest>, GuestListParams>((ref, params) async {
  return ref.watch(guestsServiceProvider).listGuests(
    eventId: params.eventId,
    query: params.query,
    status: params.status,
  );
});

class GuestsService {
  const GuestsService(this._client);

  final ApiClient _client;

  Future<List<Guest>> listGuests({
    required String eventId,
    String query = '',
    String status = 'all',
    int page = 1,
    int limit = 200,
  }) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '/events/$eventId/guests',
        queryParameters: {
          if (query.isNotEmpty) 'q': query,
          if (status != 'all') 'status': status,
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

  Future<void> markInvited(String eventId, String guestId, {String channel = 'manual'}) async {
    try {
      await _client.post<void>('/events/$eventId/guests/$guestId/mark-invited', data: {'channel': channel});
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
}
