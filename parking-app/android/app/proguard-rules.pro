# google_mlkit_text_recognition 플러그인은 4개 스크립트 인식기를 모두 참조하지만
# 이 앱은 한국어(+라틴)만 번들한다. 나머지는 R8 경고만 억제.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
