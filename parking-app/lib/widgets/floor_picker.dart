import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 층수 선택 위젯: 큰 층수 표시 + ▲▼ 스테퍼 + 자주 쓰는 층 원터치 칩.
/// 값 규칙: 음수 = 지하(B2 = -2), 양수 = 지상. 0은 건너뛴다.
class FloorPicker extends StatelessWidget {
  static const int minFloor = -10;
  static const int maxFloor = 20;
  static const List<int> quickFloors = [-5, -4, -3, -2, -1, 1];

  final int floor;
  final ValueChanged<int> onChanged;

  const FloorPicker({super.key, required this.floor, required this.onChanged});

  static String floorText(int f) => f < 0 ? 'B${-f}' : '${f}F';
  static String floorKorean(int f) => f < 0 ? '지하 ${-f}층' : '지상 $f층';

  void _step(int delta) {
    var next = floor + delta;
    if (next == 0) next = delta > 0 ? 1 : -1;
    next = next.clamp(minFloor, maxFloor);
    if (next != floor) {
      HapticFeedback.selectionClick();
      onChanged(next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isBasement = floor < 0;
    final color = isBasement ? scheme.error : scheme.primary;

    return Column(
      children: [
        Text(
          floorText(floor),
          style: TextStyle(
            fontSize: 56,
            fontWeight: FontWeight.w900,
            color: color,
            height: 1.1,
          ),
        ),
        Text(floorKorean(floor),
            style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.tonal(
                onPressed: () => _step(-1),
                style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Icon(Icons.keyboard_arrow_down, size: 28),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.tonal(
                onPressed: () => _step(1),
                style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Icon(Icons.keyboard_arrow_up, size: 28),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            for (final f in quickFloors) ...[
              Expanded(
                child: _QuickChip(
                  label: floorText(f),
                  selected: f == floor,
                  onTap: () => onChanged(f),
                ),
              ),
              if (f != quickFloors.last) const SizedBox(width: 6),
            ],
          ],
        ),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _QuickChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: selected ? scheme.primary : scheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(9),
      child: InkWell(
        borderRadius: BorderRadius.circular(9),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected ? scheme.onPrimary : scheme.onSurface,
            ),
          ),
        ),
      ),
    );
  }
}
