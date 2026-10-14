require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const replacements = [
    {
        name: 'Cámara Web Logitech Brio 4K',
        oldImageId: 'photo-1588702547919-26089e690ecc',
        image: '/images/products/product-webcam.svg'
    },
    {
        name: "Monitor LG UltraGear 27'' 144Hz",
        oldImageId: 'photo-1527443224154-c4a3942d3acf',
        image: '/images/products/monitor-ultrawide.svg'
    },
    {
        name: "Monitor Ultrawide Samsung Odyssey G9 49''",
        oldImageId: 'photo-1550745165-9bc0b252726f',
        image: '/images/products/monitor-ultrawide.svg'
    },
    {
        name: 'Micrófono Shure SM7B',
        oldImageId: 'photo-1590658268037-6bf12165a8df',
        image: '/images/products/product-microphone.svg'
    }
];

async function replaceMismatchedImages() {
    const uri = process.env.MONGO_URI || '';
    if (process.env.NODE_ENV !== 'development' || !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(uri)) {
        throw new Error('Este cambio solo se permite en una base MongoDB local de desarrollo.');
    }

    await mongoose.connect(uri);
    try {
        for (const replacement of replacements) {
            const result = await Product.updateOne(
                {
                    name: replacement.name,
                    image: { $regex: replacement.oldImageId }
                },
                { $set: { image: replacement.image } }
            );

            if (result.matchedCount === 0) {
                console.log(`Sin cambios para "${replacement.name}": no coincide la imagen antigua.`);
                continue;
            }

            console.log(
                `${replacement.name}: ${result.modifiedCount === 1 ? 'imagen actualizada' : 'ya estaba actualizada'}.`
            );
        }
    } finally {
        await mongoose.disconnect();
    }
}

replaceMismatchedImages().catch((error) => {
    console.error(`No se pudieron actualizar las imágenes del catálogo: ${error.message}`);
    process.exitCode = 1;
});
