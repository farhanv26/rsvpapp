import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/activity.dart';
import '../models/event.dart';
// ignore: unused_import
export '../models/event.dart' show ItineraryItem;

final eventsServiceProvider = Provider<EventsService>((ref) => EventsService(ref.watch(apiClientProvider)));

final eventsListProvider = FutureProvider<List<Event>>((ref) async {
  return ref.watch(eventsServiceProvider).listEvents();
});

final eventDetailProvider = FutureProvider.autoDispose.family<EventDetail, String>((ref, eventId) async {
  return ref.watch(eventsServiceProvider).getEvent(eventId);
});

final eventActivityProvider = FutureProvider.autoDispose.family<List<ActivityItem>, String>((ref, eventId) async {
  return ref.watch(eventsServiceProvider).getActivity(eventId);
});

class EventsService {
  const EventsService(this._client);

  final ApiClient _client;
  static const _requestTimeout = Duration(seconds: 15);

  Future<List<Event>> listEvents() async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>('/events')
          .timeout(_requestTimeout);
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
      final res = await _client
          .get<Map<String, dynamic>>('/events/$eventId')
          .timeout(_requestTimeout);
      return EventDetail.fromJson(res.data!);
    } on TimeoutException {
      throw const ApiException('Event details request timed out. Pull to retry.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ActivityItem>> getActivity(String eventId) async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>('/events/$eventId/activity')
          .timeout(_requestTimeout);
      final list = res.data!['activities'] as List<dynamic>;
      return list.map((e) => ActivityItem.fromJson(e as Map<String, dynamic>)).toList();
    } on TimeoutException {
      throw const ApiException('Activity request timed out. Pull to retry.');
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
      }).timeout(_requestTimeout);
    } on TimeoutException {
      throw const ApiException('Create event request timed out. Try again.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EventDetailInfo> updateEvent(
    String eventId, {
    String? title,
    String? coupleNames,
    String? eventSubtitle,
    String? venue,
    String? description,
    String? eventTime,
    DateTime? eventDate,
    bool clearEventDate = false,
    DateTime? rsvpDeadline,
    bool clearRsvpDeadline = false,
    List<ItineraryItem>? itinerary,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (coupleNames != null) body['coupleNames'] = coupleNames;
      if (eventSubtitle != null) body['eventSubtitle'] = eventSubtitle;
      if (venue != null) body['venue'] = venue;
      if (description != null) body['description'] = description;
      if (eventTime != null) body['eventTime'] = eventTime;
      if (clearEventDate) {
        body['eventDate'] = null;
      } else if (eventDate != null) {
        body['eventDate'] = eventDate.toIso8601String();
      }
      if (clearRsvpDeadline) {
        body['rsvpDeadline'] = null;
      } else if (rsvpDeadline != null) {
        body['rsvpDeadline'] = rsvpDeadline.toIso8601String();
      }
      if (itinerary != null) body['itinerary'] = itinerary.map((i) => i.toJson()).toList();

      final res = await _client.put<Map<String, dynamic>>(
        '/events/$eventId',
        data: body,
      ).timeout(_requestTimeout);
      return EventDetailInfo.fromJson(res.data!['event'] as Map<String, dynamic>);
    } on TimeoutException {
      throw const ApiException('Update event request timed out. Try again.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<String> getPreviewUrl(String eventId) async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>('/events/$eventId/preview-url')
          .timeout(_requestTimeout);
      return res.data!['previewUrl'] as String;
    } on TimeoutException {
      throw const ApiException('Preview request timed out. Try again.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteEvent(String eventId) async {
    try {
      await _client.delete<void>('/events/$eventId').timeout(_requestTimeout);
    } on TimeoutException {
      throw const ApiException('Delete event request timed out. Try again.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
