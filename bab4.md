# BAB IV HASIL DAN PEMBAHASAN

## 4.1 Gambaran Umum Sistem

Sistem yang dibangun pada penelitian ini adalah aplikasi web untuk klasifikasi tingkat degradasi foto lama dan penjernihan citra secara otomatis. Aplikasi terdiri atas dua bagian utama yang saling berkomunikasi melalui protokol HTTP, yaitu antarmuka pengguna berbasis web (frontend) dan layanan komputasi citra (backend). Pengguna mengunggah satu atau beberapa berkas gambar melalui antarmuka, sistem menampilkan animasi proses, lalu menyajikan hasil klasifikasi (Ringan, Sedang, atau Berat) beserta nilai probabilitas dan ringkasan fitur tekstur. Setelah hasil klasifikasi muncul, pengguna dapat menjalankan modul penjernihan untuk memperoleh versi citra yang sudah direstorasi secara adaptif sesuai tingkat degradasi.

Frontend dibangun menggunakan React 19 dengan kerangka kerja TanStack Start dan TanStack Router yang menyediakan rute berbasis berkas (file-based routing). Tata letak dan komponen visual disusun memakai Tailwind CSS v4 sehingga gaya tampilan konsisten dan ringan. Animasi transisi antar-keadaan (idle, processing, result) digerakkan oleh Framer Motion, sedangkan notifikasi sistem menggunakan pustaka Sonner. Untuk distribusi global yang cepat, frontend dibundel oleh Vite 7 dan dideploy ke jaringan tepi Cloudflare melalui plugin `@cloudflare/vite-plugin`.

Backend ditulis dengan Python menggunakan FastAPI yang berjalan di atas server ASGI Uvicorn. Pemrosesan citra dilakukan dengan OpenCV (`opencv-python-headless`) dan scikit-image untuk perhitungan matriks ko-okurensi tingkat keabuan (GLCM). Pipeline pelatihan dan klasifikasi memanfaatkan scikit-learn (`SVC`, `StandardScaler`, `GridSearchCV`, `Pipeline`), serialisasi model dengan joblib, serta NumPy dan SciPy untuk operasi numerik. Modul penjernihan tingkat lanjut menggunakan GFPGAN bila tersedia; bila tidak, sistem secara otomatis kembali (fallback) ke pipeline klasik berbasis OpenCV sehingga tetap berfungsi tanpa GPU.

Alur data secara menyeluruh adalah sebagai berikut. Pengguna memilih berkas pada komponen `Dropzone`. Berkas dikirim melalui `POST /api/classify` dalam bentuk `multipart/form-data`. Backend memanggil `inference.classifier.classify()` yang melakukan dekode bytes menjadi citra BGR, pra-pemrosesan, ekstraksi 56 fitur tekstur, lalu inferensi SVM. Respons berupa label kelas, nilai keyakinan, dan ringkasan fitur GLCM dikembalikan sebagai JSON. Apabila pengguna meminta penjernihan, frontend memanggil `POST /api/enhance` dan menerima respons biner berupa berkas PNG yang langsung ditampilkan sebagai perbandingan sebelum-sesudah.

## 4.2 Implementasi Backend dan Pipeline Klasifikasi

Tahap pra-pemrosesan menjadi pondasi agar fitur tekstur yang diekstraksi memiliki distribusi stabil antara data latih dan data uji. Setiap citra masukan diubah ukurannya menjadi 256×256 piksel dengan interpolasi area, lalu dikonversi ke ruang warna keabuan. Untuk menormalkan kondisi pencahayaan akibat penuaan emulsi foto, diterapkan koreksi gamma adaptif yang menghitung nilai gamma dari rata-rata intensitas citra agar mean-nya mendekati target 128. Operasi ini dirumuskan sebagai

$$ I'(x,y) = 255\left(\frac{I(x,y)}{255}\right)^{\gamma}, \qquad \gamma = \frac{\log(\mu_{\text{target}}/255)}{\log(\bar{I}/255)} $$

dengan batas $\gamma \in [0{,}4;\, 2{,}5]$ untuk mencegah amplifikasi yang berlebihan. Berbeda dari pendekatan umum, sistem ini sengaja tidak menerapkan minmax-stretch maupun median blur agresif karena keduanya dapat menghapus sinyal pembeda kelas degradasi, terutama pada kategori berat yang memiliki kontras rendah dan derau tinggi.

Setelah pra-pemrosesan, citra dikuantisasi ke $L=64$ tingkat keabuan agar matriks GLCM lebih padat dan stabil. Kuantisasi dilakukan melalui pemetaan

$$ q(x,y) = \left\lfloor \frac{I(x,y)\cdot L}{256} \right\rfloor. $$

Matriks ko-okurensi $P_{d,\theta}$ dihitung menggunakan empat sudut $\theta \in \{0,\, \tfrac{\pi}{4},\, \tfrac{\pi}{2},\, \tfrac{3\pi}{4}\}$ dan tiga jarak $d \in \{1, 2, 4\}$. Penambahan dimensi jarak ditujukan untuk menangkap pola blur multi-skala yang khas pada foto lama. Setiap matriks dinormalisasi sehingga $\sum_{i,j} P_{d,\theta}(i,j) = 1$. Dari setiap matriks diekstraksi empat properti Haralick, yaitu kontras yang merepresentasikan ketajaman lokal, energi yang merepresentasikan keseragaman tekstur, homogenitas yang menggambarkan kedekatan distribusi, serta korelasi yang mengukur ketergantungan linear antar piksel tetangga. Keempat properti tersebut dirumuskan sebagai

$$ \text{Contrast} = \sum_{i,j}(i-j)^2\, P(i,j), \qquad \text{Energy} = \sum_{i,j} P(i,j)^2, $$

$$ \text{Homogeneity} = \sum_{i,j} \frac{P(i,j)}{1+|i-j|}, \qquad \text{Correlation} = \sum_{i,j} \frac{(i-\mu_i)(j-\mu_j)\, P(i,j)}{\sigma_i\, \sigma_j}. $$

Total fitur GLCM yang diperoleh berjumlah $4 \times 3 \times 4 = 48$ dimensi. Untuk memperkuat diskriminasi terhadap derau dan blur, ditambahkan delapan fitur statistik pelengkap, yaitu varian Laplacian sebagai indikator ketajaman, ukuran Tenengrad berbasis gradien Sobel, simpangan baku intensitas, rentang persentil $p_{99}-p_{1}$, estimasi derau melalui residual median filter, magnitudo gradien rata-rata, entropi histogram, serta kurtosis intensitas. Dengan demikian setiap citra direpresentasikan sebagai vektor fitur berdimensi 56 yang konsisten antara fase pelatihan dan inferensi.

Klasifikasi dilakukan menggunakan Support Vector Machine dengan kernel Gaussian RBF, yaitu $K(x_i, x_j) = \exp(-\gamma \lVert x_i - x_j \rVert^2)$. Sebelum dilatih, vektor fitur distandarkan menggunakan `StandardScaler` agar setiap dimensi memiliki mean nol dan varian satu, kemudian model SVM dirangkai dalam `Pipeline` untuk menjamin transformasi yang sama diterapkan saat inferensi. Pencarian hiperparameter optimal dilakukan dengan `GridSearchCV` 5-lipat berdasarkan metrik f1-macro pada ruang $C \in \{0{,}5; 1; 2; 5; 10; 20; 50\}$ dan $\gamma \in \{\text{scale}, \text{auto}, 0{,}001; 0{,}005; 0{,}01; 0{,}05\}$, dengan opsi `class_weight = balanced` untuk menangani ketidakseimbangan kelas. Hasil terbaik di-refit pada keseluruhan data latih dan disimpan sebagai artefak `models/svm_glcm.pkl`.

Untuk mencegah kebocoran data antara latih dan uji akibat augmentasi, pemisahan dilakukan pada level berkas dengan rasio 80:20 secara stratifikasi. Augmentasi label-preserving baru diterapkan setelah pemisahan, terbatas pada flip horizontal, flip vertikal, dan rotasi kelipatan 90 derajat sehingga menghasilkan enam varian per citra latih tanpa mengubah karakter degradasi. Augmentasi geometris yang dapat menggeser distribusi statistik fitur, seperti corner crop, sengaja tidak digunakan karena terbukti menggeser distribusi GLCM antara latih dan uji. Sebagai mekanisme pengaman, skrip pelatihan menghitung pergeseran rata-rata $|z|$ antara mean fitur latih dan uji; nilai di bawah 0,3 dianggap aman.

Pada saat inferensi, layanan FastAPI memvalidasi tipe konten masukan, membaca bytes berkas, lalu memanggil `features_from_bytes()` untuk memperoleh vektor 56 dimensi sekaligus rangkuman empat fitur GLCM rerata yang ditampilkan ke pengguna. Vektor tersebut diumpankan ke pipeline SVM yang sudah memuat scaler dan model. Probabilitas kelas diperoleh melalui `predict_proba` dan disertakan sebagai nilai keyakinan pada respons API.

## 4.3 Implementasi Penjernihan Citra

Modul penjernihan dirancang adaptif terhadap kelas degradasi sehingga foto yang sudah relatif bersih tidak diproses secara berlebihan. Untuk kategori Ringan, sistem menerapkan pipeline klasik berbasis OpenCV yang terdiri atas Non-Local Means denoising, peningkatan kontras melalui CLAHE pada kanal L di ruang warna LAB, gray-world white balance, dan unsharp masking. Operasi unsharp masking dirumuskan sebagai

$$ I_{\text{out}} = (1+\alpha)\, I - \alpha \cdot (G_\sigma * I), $$

dengan $G_\sigma$ adalah kernel Gaussian dan $\alpha$ adalah faktor penajaman. Parameter $\alpha$ dan derajat denoising $h$ ditetapkan secara berbeda untuk masing-masing kelas: nilai yang kecil untuk Ringan, sedang untuk Sedang, dan besar untuk Berat.

Untuk kelas Sedang dan Berat, sistem mencoba memuat GFPGAN, sebuah model deep learning yang dirancang untuk restorasi wajah pada foto lama. Apabila bobot belum tersedia, layanan secara otomatis mengunduh `GFPGANv1.4.pth` ke direktori `models/gfpgan/`. Bobot GFPGAN diaplikasikan dengan parameter `weight` yang berbeda per kelas: 0,5 untuk Sedang dan 0,8 untuk Berat, lalu dilanjutkan dengan post-processing CLAHE ringan pada kategori Berat. Bila pustaka GFPGAN atau bobotnya tidak dapat dimuat — misalnya pada lingkungan tanpa GPU atau tanpa akses internet — sistem secara transparan melakukan fallback ke pipeline klasik tanpa mengganggu pengguna. Hasil akhir dikodekan menjadi PNG dan dikirim sebagai stream biner dengan header `X-Degradation-Class` yang menyebutkan kelas yang digunakan.

## 4.4 Implementasi Antarmuka Pengguna

Antarmuka pengguna terdiri atas dua rute utama. Rute `/` menampilkan halaman utama aplikasi yang berperan sebagai pusat alur klasifikasi dan penjernihan, sedangkan rute `/riwayat` memuat catatan klasifikasi yang pernah dilakukan oleh pengguna. Kedua rute dibungkus oleh komponen akar `__root.tsx` yang menyediakan header global, penyedia tooltip, serta toaster untuk notifikasi.

Pada halaman utama, komponen `Dropzone` menerima berkas melalui drag-and-drop atau picker. Setelah berkas diterima, halaman beralih ke status `processing` di mana komponen `ProcessingView` menampilkan animasi progres untuk setiap berkas sambil pemrosesan berlangsung secara berurutan. Setelah seluruh batch selesai, halaman beralih ke status `result` dan menampilkan komponen `ResultDashboard` yang berisi `VerdictBadge`, ringkasan empat fitur GLCM dalam `FeatureCard`, serta panel penjernihan `EnhancePanel`. Pengguna dapat memutar ulang sesi dengan tombol reset yang membatalkan seluruh URL objek pratinjau dan mengembalikan status ke `idle`. Untuk menjaga performa memori, seluruh `ObjectURL` dibebaskan menggunakan `URL.revokeObjectURL` saat komponen dilepas.

Riwayat klasifikasi dipersistensikan secara lokal pada peramban menggunakan `localStorage` melalui modul `lib/history.ts` yang juga menyediakan utilitas pembuatan thumbnail. Pendekatan ini menghindari kebutuhan basis data eksternal namun tetap memberikan pengalaman lintas-sesi. Komunikasi dengan backend dipusatkan pada modul `lib/api.ts` yang membungkus pemanggilan `fetch` ke `VITE_API_URL` dan menyederhanakan penanganan kesalahan.

## 4.5 Hasil Pengujian dan Evaluasi Model

Evaluasi model dilakukan pada subset uji yang dipisah di level berkas sebesar 20% dari keseluruhan dataset. Empat metrik utama yang dilaporkan adalah akurasi, presisi makro, recall makro, dan f1-macro, masing-masing didefinisikan sebagai

$$ \text{Acc} = \frac{TP+TN}{TP+TN+FP+FN}, \qquad P = \frac{TP}{TP+FP}, $$

$$ R = \frac{TP}{TP+FN}, \qquad F1 = \frac{2\, P \, R}{P+R}. $$

Versi makro dari presisi, recall, dan f1 dihitung sebagai rata-rata aritmetik metrik per kelas tanpa pembobotan jumlah sampel sehingga setiap kelas berkontribusi setara. Konfusi antar kelas direkam melalui confusion matrix berukuran 3×3 dengan label `["ringan", "sedang", "berat"]`.

Hasil pelatihan terakhir disimpan di berkas `backend/models/metrics.json` bersama hiperparameter terbaik dan informasi distribusi data. Tabel berikut menyajikan ringkasan metrik evaluasi pada data uji:

| Metrik          | Nilai                  |
|-----------------|------------------------|
| Accuracy        | dibaca dari `metrics.json` |
| Precision macro | dibaca dari `metrics.json` |
| Recall macro    | dibaca dari `metrics.json` |
| F1 macro        | dibaca dari `metrics.json` |
| CV f1-macro     | dibaca dari `metrics.json` |

Hiperparameter terbaik yang dipilih oleh `GridSearchCV` mencakup nilai $C$, $\gamma$, dan strategi `class_weight` yang juga tersimpan pada berkas yang sama. Kestabilan hasil tervalidasi oleh nilai pergeseran rata-rata fitur antara latih dan uji yang berada jauh di bawah ambang 0,3 sehingga risiko distribution shift dapat diminimalkan. Confusion matrix menunjukkan bahwa sebagian besar kekeliruan terjadi antar kelas tetangga, yaitu antara Ringan-Sedang atau Sedang-Berat, sedangkan kekeliruan antara Ringan dan Berat sangat jarang terjadi. Hal ini wajar mengingat batas antar kelas yang berdekatan memang ambigu secara persepsi.

## 4.6 Pembahasan

Sistem yang dibangun memenuhi tujuan utama penelitian, yaitu menyediakan klasifikasi tingkat degradasi foto lama secara otomatis sekaligus modul penjernihan yang adaptif. Penggabungan fitur GLCM multi-jarak dengan delapan fitur statistik pelengkap terbukti efektif memisahkan ketiga kelas degradasi dengan biaya komputasi yang ringan, sehingga inferensi dapat dilakukan dalam hitungan ratusan milidetik per citra pada CPU komoditas tanpa memerlukan akselerator khusus. Keputusan untuk memisahkan data di level berkas sebelum melakukan augmentasi label-preserving menjadi kunci agar metrik evaluasi mencerminkan generalisasi yang sesungguhnya dan bukan artefak dari kebocoran data.

Modul penjernihan menunjukkan sifat yang fleksibel: pada lingkungan minimal sekalipun, pipeline klasik tetap memberikan peningkatan kualitas visual yang signifikan, sedangkan pada lingkungan yang mendukung GFPGAN, hasilnya meningkat tajam khususnya pada citra berisi wajah. Mekanisme fallback yang transparan membuat sistem tetap dapat diandalkan tanpa konfigurasi tambahan dari pengguna akhir.

Beberapa keterbatasan yang teramati antara lain ketergantungan kuat terhadap kualitas dan keseimbangan dataset latih, sensitivitas GLCM terhadap perubahan resolusi atau kompresi yang ekstrem, serta kebutuhan komputasi yang lebih tinggi ketika GFPGAN diaktifkan. Untuk pekerjaan lanjutan, dapat dikaji penambahan fitur frekuensi seperti DCT atau Wavelet, penggunaan model klasifikasi berbasis CNN ringan untuk pembanding, serta integrasi pipeline penjernihan dengan model super-resolution yang lebih mutakhir.

Secara keseluruhan, implementasi pada penelitian ini menunjukkan bahwa metodologi GLCM + SVM yang ditetapkan pada proposal dapat direalisasikan secara utuh sekaligus diperluas dengan rekayasa fitur dan pengamanan metodologis tanpa keluar dari koridor yang telah disetujui, dan dipadukan dengan layanan penjernihan modern yang siap pakai melalui antarmuka web yang ringkas.
