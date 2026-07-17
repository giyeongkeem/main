import 'package:flutter/material.dart';

import '../models/parking_record.dart';
import '../services/storage_service.dart';

/// 지난 주차 기록 목록.
class HistoryTab extends StatefulWidget {
  const HistoryTab({super.key});

  @override
  State<HistoryTab> createState() => HistoryTabState();
}

class HistoryTabState extends State<HistoryTab> {
  List<ParkingRecord> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    final items = await StorageService.instance.loadHistory();
    if (mounted) {
      setState(() {
        _items = items;
        _loading = false;
      });
    }
  }

  Future<void> _delete(ParkingRecord r) async {
    await StorageService.instance.deleteHistoryItem(r.id);
    await reload();
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('전체 삭제'),
        content: const Text('지난 주차 기록을 모두 삭제할까요?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('삭제')),
        ],
      ),
    );
    if (ok == true) {
      await StorageService.instance.clearHistory();
      await reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('📂', style: TextStyle(fontSize: 44)),
            const SizedBox(height: 12),
            Text('지난 주차 기록이 없어요.\n주차를 종료하면 여기에 쌓여요.',
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.onSurfaceVariant)),
          ],
        ),
      );
    }

    // +1: 마지막 줄의 "전체 기록 삭제" 버튼. builder라 기록이 많아도 보이는 만큼만 그린다.
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: _items.length + 1,
      itemBuilder: (context, i) {
        if (i == _items.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TextButton.icon(
              onPressed: _clearAll,
              icon: Icon(Icons.delete_sweep_outlined, color: scheme.error),
              label:
                  Text('전체 기록 삭제', style: TextStyle(color: scheme.error)),
            ),
          );
        }
        final r = _items[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          clipBehavior: Clip.antiAlias,
          child: Dismissible(
            key: ValueKey(r.id),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20),
              color: scheme.errorContainer,
              child: Icon(Icons.delete_outline, color: scheme.onErrorContainer),
            ),
            onDismissed: (_) => _delete(r),
            child: ListTile(
              leading: Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: r.isBasement
                      ? scheme.errorContainer
                      : scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Text(
                  r.floorText,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: r.isBasement
                        ? scheme.onErrorContainer
                        : scheme.onPrimaryContainer,
                  ),
                ),
              ),
              title: Text(
                r.placeLine.isEmpty ? '위치 정보 없음' : r.placeLine,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                '${formatDateTime(r.ts)}${r.memo.isEmpty ? '' : ' · ${r.memo}'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      },
    );
  }
}
