import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/event.dart';
import '../../core/services/events_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';

class EditEventScreen extends ConsumerStatefulWidget {
  const EditEventScreen({super.key, required this.event});
  final EventDetailInfo event;

  @override
  ConsumerState<EditEventScreen> createState() => _EditEventScreenState();
}

class _EditEventScreenState extends ConsumerState<EditEventScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _coupleNamesCtrl;
  late final TextEditingController _subtitleCtrl;
  late final TextEditingController _venueCtrl;
  late final TextEditingController _descriptionCtrl;
  late final TextEditingController _eventTimeCtrl;
  late DateTime? _eventDate;
  late DateTime? _rsvpDeadline;
  late List<ItineraryItem> _itinerary;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.event;
    _titleCtrl = TextEditingController(text: e.title);
    _coupleNamesCtrl = TextEditingController(text: e.coupleNames ?? '');
    _subtitleCtrl = TextEditingController(text: e.eventSubtitle ?? '');
    _venueCtrl = TextEditingController(text: e.venue ?? '');
    _descriptionCtrl = TextEditingController(text: e.description ?? '');
    _eventTimeCtrl = TextEditingController(text: e.eventTime ?? '');
    _eventDate = e.eventDate;
    _rsvpDeadline = e.rsvpDeadline;
    _itinerary = List.from(e.itinerary);
  }

  @override
  void dispose() {
    for (final c in [_titleCtrl, _coupleNamesCtrl, _subtitleCtrl, _venueCtrl, _descriptionCtrl, _eventTimeCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      final updated = await ref.read(eventsServiceProvider).updateEvent(
        widget.event.id,
        title: _titleCtrl.text.trim(),
        coupleNames: _coupleNamesCtrl.text.trim(),
        eventSubtitle: _subtitleCtrl.text.trim(),
        venue: _venueCtrl.text.trim(),
        description: _descriptionCtrl.text.trim(),
        eventTime: _eventTimeCtrl.text.trim(),
        eventDate: _eventDate,
        clearEventDate: _eventDate == null && widget.event.eventDate != null,
        rsvpDeadline: _rsvpDeadline,
        clearRsvpDeadline: _rsvpDeadline == null && widget.event.rsvpDeadline != null,
        itinerary: _itinerary,
      );
      ref.invalidate(eventDetailProvider(widget.event.id));
      if (mounted) Navigator.pop(context, updated);
    } catch (e) {
      setState(() { _error = userFacingErrorMessage(e); _saving = false; });
    }
  }

  Future<void> _pickDate(bool isRsvp) async {
    final initial = (isRsvp ? _rsvpDeadline : _eventDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.brandDeep,
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
        if (isRsvp) { _rsvpDeadline = picked; } else { _eventDate = picked; }
      });
    }
  }

  // ── Itinerary helpers ────────────────────────────────────────────

  void _addItem() {
    setState(() => _itinerary = [..._itinerary, const ItineraryItem(title: '')]);
  }

  void _removeItem(int i) {
    setState(() { final l = List<ItineraryItem>.from(_itinerary); l.removeAt(i); _itinerary = l; });
  }

  void _moveItem(int i, int dir) {
    final target = i + dir;
    if (target < 0 || target >= _itinerary.length) return;
    setState(() {
      final l = List<ItineraryItem>.from(_itinerary);
      final tmp = l[i]; l[i] = l[target]; l[target] = tmp;
      _itinerary = l;
    });
  }

  void _updateItem(int i, ItineraryItem item) {
    setState(() {
      final l = List<ItineraryItem>.from(_itinerary);
      l[i] = item;
      _itinerary = l;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Edit Event', style: AppTextStyles.titleMedium),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _saving
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                  )
                : TextButton(
                    onPressed: _save,
                    child: const Text(
                      'Save',
                      style: TextStyle(color: AppColors.brandAccent, fontWeight: FontWeight.w700, fontSize: 15),
                    ),
                  ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
          children: [
            if (_error != null) ...[
              _ErrorBanner(message: _error!),
              const SizedBox(height: 16),
            ],

            // ── Identity ──
            const _SectionLabel('Identity'),
            const SizedBox(height: 10),
            TextFormField(
              controller: _titleCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Event title *',
                prefixIcon: Icon(Icons.event_rounded, size: 20),
              ),
              validator: (v) => v == null || v.trim().isEmpty ? 'Title is required' : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _coupleNamesCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Couple / host names',
                prefixIcon: Icon(Icons.favorite_border_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _subtitleCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Subtitle',
                hintText: 'e.g. Walima Reception',
                prefixIcon: Icon(Icons.short_text_rounded, size: 20),
              ),
            ),

            const SizedBox(height: 24),

            // ── Venue & Description ──
            const _SectionLabel('Venue & Details'),
            const SizedBox(height: 10),
            TextFormField(
              controller: _venueCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Venue',
                prefixIcon: Icon(Icons.location_on_outlined, size: 20),
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _descriptionCtrl,
              textCapitalization: TextCapitalization.sentences,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Description',
                alignLabelWithHint: true,
                prefixIcon: Padding(
                  padding: EdgeInsets.only(bottom: 40),
                  child: Icon(Icons.notes_rounded, size: 20),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── Schedule ──
            const _SectionLabel('Schedule'),
            const SizedBox(height: 10),
            _DatePickerTile(
              label: 'Event date',
              icon: Icons.calendar_today_outlined,
              value: _eventDate,
              onTap: () => _pickDate(false),
              onClear: () => setState(() => _eventDate = null),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _eventTimeCtrl,
              decoration: const InputDecoration(
                labelText: 'Event time',
                hintText: 'e.g. 7:00 PM',
                prefixIcon: Icon(Icons.access_time_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 10),
            _DatePickerTile(
              label: 'RSVP deadline',
              icon: Icons.timer_outlined,
              value: _rsvpDeadline,
              onTap: () => _pickDate(true),
              onClear: () => setState(() => _rsvpDeadline = null),
            ),

            const SizedBox(height: 24),

            // ── Itinerary ──
            const _SectionLabel('Itinerary'),
            const SizedBox(height: 4),
            const Text(
              'Build the event timeline shown to guests.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            if (_itinerary.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Center(
                  child: Text(
                    'No itinerary items yet',
                    style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                  ),
                ),
              )
            else
              ...List.generate(_itinerary.length, (i) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ItineraryItemEditor(
                  item: _itinerary[i],
                  index: i,
                  total: _itinerary.length,
                  onChanged: (item) => _updateItem(i, item),
                  onRemove: () => _removeItem(i),
                  onMoveUp: i > 0 ? () => _moveItem(i, -1) : null,
                  onMoveDown: i < _itinerary.length - 1 ? () => _moveItem(i, 1) : null,
                ),
              )),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _addItem,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add itinerary item'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 46),
                foregroundColor: AppColors.brandDeep,
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
              ),
            ),

            const SizedBox(height: 36),

            // ── Save button ──
            GestureDetector(
              onTap: _saving ? null : _save,
              child: AnimatedOpacity(
                opacity: _saving ? 0.5 : 1.0,
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
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textOnAccent),
                          )
                        : const Text(
                            'Save Changes',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textOnAccent,
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
    );
  }
}

// ── Section label ──────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: AppTextStyles.sectionLabel);
}

// ── Error banner ───────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Text(message, style: const TextStyle(color: AppColors.danger, fontSize: 13))),
          ],
        ),
      );
}

// ── Date picker tile ───────────────────────────────────────────────

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
    final hasValue = value != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: hasValue ? AppColors.brandDeep.withValues(alpha: 0.3) : AppColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: hasValue ? AppColors.brandDeep : AppColors.textMuted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                hasValue ? DateFormat('EEEE, d MMMM yyyy').format(value!) : label,
                style: TextStyle(
                  fontSize: 14,
                  color: hasValue ? AppColors.textPrimary : AppColors.textMuted,
                  fontWeight: hasValue ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ),
            if (hasValue)
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

// ── Itinerary item editor ──────────────────────────────────────────

class _ItineraryItemEditor extends StatefulWidget {
  const _ItineraryItemEditor({
    required this.item,
    required this.index,
    required this.total,
    required this.onChanged,
    required this.onRemove,
    this.onMoveUp,
    this.onMoveDown,
  });
  final ItineraryItem item;
  final int index;
  final int total;
  final ValueChanged<ItineraryItem> onChanged;
  final VoidCallback onRemove;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  @override
  State<_ItineraryItemEditor> createState() => _ItineraryItemEditorState();
}

class _ItineraryItemEditorState extends State<_ItineraryItemEditor> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _startCtrl;
  late final TextEditingController _endCtrl;
  late final TextEditingController _descCtrl;
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.item.title);
    _startCtrl = TextEditingController(text: widget.item.startTime ?? widget.item.time ?? '');
    _endCtrl = TextEditingController(text: widget.item.endTime ?? '');
    _descCtrl = TextEditingController(text: widget.item.description ?? '');
    // Expand new empty items automatically
    _expanded = widget.item.title.isEmpty;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _startCtrl.dispose();
    _endCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _emit() {
    widget.onChanged(ItineraryItem(
      startTime: _startCtrl.text.trim().isEmpty ? null : _startCtrl.text.trim(),
      endTime: _endCtrl.text.trim().isEmpty ? null : _endCtrl.text.trim(),
      title: _titleCtrl.text.trim(),
      icon: widget.item.icon,
      description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final hasTitle = widget.item.title.isNotEmpty;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          // ── Row header ──
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.md)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.brandAccent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '${widget.index + 1}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brandAccent),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      hasTitle ? widget.item.title : 'New item',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: hasTitle ? AppColors.textPrimary : AppColors.textMuted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (widget.item.displayTime.isNotEmpty)
                    Text(
                      widget.item.displayTime,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  const SizedBox(width: 4),
                  Icon(
                    _expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    size: 18,
                    color: AppColors.textMuted,
                  ),
                ],
              ),
            ),
          ),

          // ── Expanded fields ──
          if (_expanded) ...[
            const Divider(height: 1, color: AppColors.borderLight),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
              child: Column(
                children: [
                  TextField(
                    controller: _titleCtrl,
                    textCapitalization: TextCapitalization.words,
                    onChanged: (_) => _emit(),
                    decoration: const InputDecoration(
                      labelText: 'Item title *',
                      hintText: 'e.g. Nikkah Ceremony',
                      prefixIcon: Icon(Icons.title_rounded, size: 18),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _startCtrl,
                          onChanged: (_) => _emit(),
                          decoration: const InputDecoration(
                            labelText: 'Start time',
                            hintText: '7:00 PM',
                            prefixIcon: Icon(Icons.access_time_rounded, size: 18),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _endCtrl,
                          onChanged: (_) => _emit(),
                          decoration: const InputDecoration(
                            labelText: 'End time',
                            hintText: '8:30 PM',
                            prefixIcon: Icon(Icons.access_time_filled_rounded, size: 18),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _descCtrl,
                    maxLines: 2,
                    onChanged: (_) => _emit(),
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Description (optional)',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: [
                  if (widget.onMoveUp != null)
                    IconButton(
                      icon: const Icon(Icons.arrow_upward_rounded, size: 18),
                      color: AppColors.textSecondary,
                      onPressed: widget.onMoveUp,
                      tooltip: 'Move up',
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                  if (widget.onMoveDown != null)
                    IconButton(
                      icon: const Icon(Icons.arrow_downward_rounded, size: 18),
                      color: AppColors.textSecondary,
                      onPressed: widget.onMoveDown,
                      tooltip: 'Move down',
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      padding: EdgeInsets.zero,
                    ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: widget.onRemove,
                    icon: const Icon(Icons.delete_outline_rounded, size: 16),
                    label: const Text('Remove'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.danger, textStyle: const TextStyle(fontSize: 13)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
