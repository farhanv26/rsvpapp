import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/services/events_service.dart';
import '../../shared/theme/app_theme.dart';

class CreateEventScreen extends ConsumerStatefulWidget {
  const CreateEventScreen({super.key});

  @override
  ConsumerState<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends ConsumerState<CreateEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _coupleNamesCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  DateTime? _eventDate;
  DateTime? _rsvpDeadline;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _coupleNamesCtrl.dispose();
    _venueCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(eventsServiceProvider).createEvent(
        title: _titleCtrl.text.trim(),
        coupleNames: _coupleNamesCtrl.text.trim().isEmpty ? null : _coupleNamesCtrl.text.trim(),
        venue: _venueCtrl.text.trim().isEmpty ? null : _venueCtrl.text.trim(),
        eventDate: _eventDate,
        rsvpDeadline: _rsvpDeadline,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim();
        _saving = false;
      });
    }
  }

  Future<void> _pickDate(bool isRsvpDeadline) async {
    final initial = isRsvpDeadline ? (_rsvpDeadline ?? DateTime.now()) : (_eventDate ?? DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.brandAccent,
            onPrimary: AppColors.textInverse,
            surface: AppColors.surfaceElevated,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isRsvpDeadline) {
          _rsvpDeadline = picked;
        } else {
          _eventDate = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('New Event'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                  )
                : TextButton(
                    onPressed: _save,
                    child: const Text(
                      'Create',
                      style: TextStyle(
                        color: AppColors.brandAccent,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 14)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              const _SectionLabel('Event Details'),
              const SizedBox(height: 10),

              TextFormField(
                controller: _titleCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Event title *',
                  hintText: 'e.g. Ahmed & Sara Wedding',
                  prefixIcon: Icon(Icons.event_rounded, size: 20),
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Title is required' : null,
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _coupleNamesCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Couple / host names',
                  hintText: 'e.g. Ahmed & Sara',
                  prefixIcon: Icon(Icons.favorite_border_rounded, size: 20),
                ),
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _venueCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Venue',
                  hintText: 'e.g. Grand Ballroom, Hilton',
                  prefixIcon: Icon(Icons.location_on_outlined, size: 20),
                ),
              ),

              const SizedBox(height: 28),
              const _SectionLabel('Dates'),
              const SizedBox(height: 10),

              _DatePickerTile(
                label: 'Event date',
                icon: Icons.calendar_today_outlined,
                value: _eventDate,
                onTap: () => _pickDate(false),
                onClear: () => setState(() => _eventDate = null),
              ),
              const SizedBox(height: 10),
              _DatePickerTile(
                label: 'RSVP deadline',
                icon: Icons.access_time_rounded,
                value: _rsvpDeadline,
                onTap: () => _pickDate(true),
                onClear: () => setState(() => _rsvpDeadline = null),
              ),

              const SizedBox(height: 40),

              GestureDetector(
                onTap: _saving ? null : _save,
                child: AnimatedOpacity(
                  opacity: _saving ? 0.6 : 1.0,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    width: double.infinity,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: AppShadows.button,
                    ),
                    child: Center(
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.textInverse,
                              ),
                            )
                          : const Text(
                              'Create Event',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textInverse,
                                letterSpacing: -0.2,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text.toUpperCase(), style: AppTextStyles.sectionLabel);
  }
}

class _DatePickerTile extends StatelessWidget {
  const _DatePickerTile({
    required this.label,
    required this.icon,
    required this.value,
    required this.onTap,
    required this.onClear,
  });
  final String label;
  final IconData icon;
  final DateTime? value;
  final VoidCallback onTap;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: value != null ? AppColors.brandAccent.withValues(alpha: 0.4) : AppColors.border,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: value != null ? AppColors.brandAccent : AppColors.textMuted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value != null ? DateFormat('EEEE, d MMMM yyyy').format(value!) : label,
                style: TextStyle(
                  fontSize: 15,
                  color: value != null ? AppColors.textPrimary : AppColors.textMuted,
                  fontWeight: value != null ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ),
            if (value != null)
              GestureDetector(
                onTap: onClear,
                child: const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Icon(Icons.close_rounded, size: 16, color: AppColors.textMuted),
                ),
              )
            else
              const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
