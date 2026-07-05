import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/parking_record.dart';

/// 모든 데이터는 기기 안에만 저장된다 (서버 없음).
class StorageService {
  static const _kCurrent = 'parking.current.v1';
  static const _kHistory = 'parking.history.v1';
  static const _kLastFloor = 'parking.lastFloor.v1';
  static const _maxHistory = 100;

  StorageService._();
  static final StorageService instance = StorageService._();

  Future<ParkingRecord?> loadCurrent() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_kCurrent);
    if (raw == null) return null;
    try {
      return ParkingRecord.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveCurrent(ParkingRecord record) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kCurrent, jsonEncode(record.toJson()));
  }

  /// 현재 주차를 종료하고 히스토리로 이동
  Future<void> finishCurrent() async {
    final cur = await loadCurrent();
    if (cur == null) return;
    final sp = await SharedPreferences.getInstance();
    final hist = await loadHistory();
    hist.insert(0, cur);
    while (hist.length > _maxHistory) {
      final removed = hist.removeLast();
      _deletePhoto(removed.photoPath);
    }
    await sp.setString(
        _kHistory, jsonEncode(hist.map((r) => r.toJson()).toList()));
    await sp.remove(_kCurrent);
  }

  Future<List<ParkingRecord>> loadHistory() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_kHistory);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((e) => ParkingRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> deleteHistoryItem(int id) async {
    final sp = await SharedPreferences.getInstance();
    final hist = await loadHistory();
    for (final r in hist.where((r) => r.id == id)) {
      _deletePhoto(r.photoPath);
    }
    hist.removeWhere((r) => r.id == id);
    await sp.setString(
        _kHistory, jsonEncode(hist.map((r) => r.toJson()).toList()));
  }

  Future<void> clearHistory() async {
    final sp = await SharedPreferences.getInstance();
    for (final r in await loadHistory()) {
      _deletePhoto(r.photoPath);
    }
    await sp.remove(_kHistory);
  }

  Future<int> loadLastFloor() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getInt(_kLastFloor) ?? -2;
  }

  Future<void> saveLastFloor(int floor) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setInt(_kLastFloor, floor);
  }

  void _deletePhoto(String? path) {
    if (path == null) return;
    try {
      final f = File(path);
      if (f.existsSync()) f.deleteSync();
    } catch (_) {}
  }
}
