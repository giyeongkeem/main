import 'package:flutter/material.dart';

import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EodijuchaApp());
}

class EodijuchaApp extends StatelessWidget {
  const EodijuchaApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF1A73E8);
    return MaterialApp(
      title: '어디주차',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme:
            ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
