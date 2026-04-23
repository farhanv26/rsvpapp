import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/event.dart';

final eventsServiceProvider = Provider<EventsService>((ref) => EventsService(ref.watch(apiClientProvider)));

final eventsListProvider = FutureProvider<List<Event>>((ref) async {
  return ref.watch(eventsServiceProvider).listEvents();
});

final eventDetailProvider = FutureProvider.family<EventDetail, String>((ref, eventId) async {
  return ref.watch(eventsServiceProvider).getEvent(eventId);
});

class EventsService {
  const EventsService(this._client);

  final ApiClient _client;

  Future<List<Event>> listEvents() async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/events');
      final list = res.data!['events'] as List<dynamic>;
      return list.map((e) => Event.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EventDetail> getEvent(String eventId) async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/events/$eventId');
      return EventDetail.fromJson(res.data!);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
