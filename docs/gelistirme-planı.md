# Geliştirme Planı - Global Accounting

## 1. Lokalizasyon Tamamlama
- [x] PDF / Excel / Word sunucu üretimi için fa/he/ku LOCALE_INTL
- [x] Başlık / damga / müşteri Excel çevirileri
- [ ] Kategori ve ödeme tipi etiketlerinin tüm dillerde tutarlı çevirisi
- [ ] PDF/Word/JPG için RTL sayfa yönü ve font desteği ar/fa/he
- [ ] Otomatik ülke tespiti sonrası export URL'lerine locale parametresinin kalıcı aktarımı

## 2. Rapor Çıktıları Kalitesi
- [ ] PDF vektör satır kırılma kontrolü + RTL metin hizalama
- [ ] Excel para formatının locale'a göre dinamik güncellenmesi
- [ ] Word belgelerinde RTL paragraf yönü
- [ ] JPG canvas için RTL metin çizimi

## 3. Veri Çevirisi
- [ ] Kategori sözlüğü tüm diller için merkezi KAT_MAP
- [ ] Kullanıcı tanımlı kategori isimlerinin dil değişiminde gösterimi
- [ ] Açıklama metinleri için otomatik çeviri seçeneği (opsiyonel)

## 4. Test & İzleme
- [ ] Her dil için PDF/Excel/Word üretim entegrasyon testi
- [ ] GeoLocale + locale lock davranış testi
- [ ] Hata loglama ve fallback raporlama

Sonraki adım: Kategori çevirisi ve RTL PDF desteği.
