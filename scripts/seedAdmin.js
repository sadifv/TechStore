require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    // Conectar a MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/techstore';
    await mongoose.connect(mongoURI);
    console.log('Conectado a MongoDB...');

    const adminEmail = 'admin@techstore.com';
    const rawPassword = 'admin123password'; // Contraseña que usarás para entrar

    // Verificar si el usuario admin ya existe
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('El usuario administrador ya existe en la base de datos.');
      process.exit(0);
    }

    // Encriptar la contraseña con bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    // Crear el usuario administrador
    const adminUser = new User({
      name: 'Admin Sadi',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin'
    });

    await adminUser.save();

    
    console.log('¡Usuario Administrador creado con éxito!');
    console.log(`Email:      ${adminEmail}`);
    console.log(`Contraseña: ${rawPassword}`);
    

    process.exit(0);
  } catch (error) {
    console.error('Error al crear el usuario administrador:', error);
    process.exit(1);
  }
};

seedAdmin();