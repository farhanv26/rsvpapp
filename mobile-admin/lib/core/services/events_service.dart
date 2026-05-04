import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/activity.dart';
import '../models/event.dart';

final eventsServiceProvider = Provider<EventsService>((ref) => EventsService(ref.watch(apiClientProvider)));

final eventsListProvider = FutureProvider<List<Event>>((ref) async {
  return ref.watch(eventsServiceProvider).listEvents();
});

final eventDetailProvider = FutureProvider.family<EventDetail, String>((ref, eventId) async {
  return ref.watch(eventsServiceProvider).getEvent(eventId);
});

final eventActivityProvider = FutureProvider.family<List<ActivityItem>, String>((ref, eventId) async {
  return ref.watch(eventsServiceProvider).getActivity(eventId);
});

class EventsService {
  const EventsService(this._client);

  final ApiClient _client;

  Future<List<Event>> listEvents() async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>('/events')
          .timeout(const Duration(seconds: 8));
      final list = res.data!['events'] as List<dynamic>;
      return list.map((e) => Event.fromJson(e as Map<String, dynamic>)).toList();
    } on TimeoutException {
      throw const ApiException('Request timed out. Check your connection.');
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

  Future<List<ActivityItem>> getActivity(String eventId) async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/events/$eventId/activity');
      final list = res.data!['activities'] as List<dynamic>;
      return list.map((e) => ActivityItem.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> createEvent({
    required String title,
    String? coupleNames,
    String? venue,
    DateTime? eventDate,
    DateTime? rsvpDeadline,
  }) async {
    try {
      await _client.post<Map<String, dynamic>>('/events', data: {
        'title': title,
        if (coupleNames != null) 'coupleNames': coupleNames,
        if (venue != null) 'venue': venue,
        if (eventDate != null) 'eventDate': eventDate.toIso8601String(),
        if (rsvpDeadline != null) 'rsvpDeadline': rsvpDeadline.toIso8601String(),
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
