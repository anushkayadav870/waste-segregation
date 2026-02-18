import os
import shutil
import random

# ==============================
# CONFIGURATION
# ==============================
SOURCE_DIR = os.path.expanduser("~/Documents/github/Waste-Identifiacation/dataset")
TARGET_DIR = os.path.expanduser("~/Documents/github/Waste-Identifiacation/split")

CLASSES = ["cardboard", "metal", "plastic"]

TRAIN_RATIO = 0.7
TEST_RATIO = 0.2
BUFFER_RATIO = 0.1

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")

random.seed(42)  # for reproducibility

# ==============================
# CREATE FOLDER STRUCTURE
# ==============================
for split in ["train", "test", "buffer"]:
    for cls in CLASSES:
        os.makedirs(os.path.join(TARGET_DIR, split, cls), exist_ok=True)

# ==============================
# SPLIT DATA
# ==============================
for cls in CLASSES:
    class_path = os.path.join(SOURCE_DIR, cls)
    images = [
        f for f in os.listdir(class_path)
        if f.lower().endswith(IMAGE_EXTENSIONS)
    ]

    random.shuffle(images)
    total = len(images)

    train_end = int(total * TRAIN_RATIO)
    test_end = train_end + int(total * TEST_RATIO)

    train_images = images[:train_end]
    test_images = images[train_end:test_end]
    buffer_images = images[test_end:]

    for img in train_images:
        shutil.copy(
            os.path.join(class_path, img),
            os.path.join(TARGET_DIR, "train", cls, img)
        )

    for img in test_images:
        shutil.copy(
            os.path.join(class_path, img),
            os.path.join(TARGET_DIR, "test", cls, img)
        )

    for img in buffer_images:
        shutil.copy(
            os.path.join(class_path, img),
            os.path.join(TARGET_DIR, "buffer", cls, img)
        )

    print(f"✅ {cls}: {len(train_images)} train, {len(test_images)} test, {len(buffer_images)} buffer")

print("\n🎉 Dataset split completed successfully!")
