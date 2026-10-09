document.addEventListener('DOMContentLoaded', async () => {
    const ordersList = document.getElementById('orders-list');
    const ordersLoading = document.getElementById('orders-loading');

    try {
        const response = await fetch('/api/orders');
        const responseData = await response.json();

        if (ordersLoading) {
            ordersLoading.style.display = 'none';
        }

        // Determinar si el arreglo viene como responseData.orders o responseData directo
        const orders = Array.isArray(responseData) 
            ? responseData 
            : (responseData.orders || responseData.data || []);

        if (response.ok && orders.length > 0) {
            orders.forEach(order => {
                // Tarjeta de Orden Semántica (<article>)
                const orderCard = document.createElement('article');
                orderCard.classList.add('order-card');

                // Encabezado de la Orden (<header>)
                const header = document.createElement('header');
                header.classList.add('order-header');

                const metaGroup = document.createElement('hgroup');
                
                const orderId = document.createElement('strong');
                orderId.classList.add('order-id');
                orderId.textContent = `Orden #${(order._id || '').substring(0, 8)}`;

                const orderDate = document.createElement('time');
                orderDate.classList.add('order-date');
                orderDate.dateTime = order.createdAt || new Date();
                orderDate.textContent = new Date(order.createdAt || Date.now()).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                metaGroup.appendChild(orderId);
                metaGroup.appendChild(document.createTextNode(' - '));
                metaGroup.appendChild(orderDate);

                const statusBadge = document.createElement('span');
                statusBadge.classList.add('order-status', `status-${order.status || 'completed'}`);
                statusBadge.textContent = order.status === 'pending' ? 'Pendiente' : 'Completado';

                header.appendChild(metaGroup);
                header.appendChild(statusBadge);

                // Lista de Productos Semántica (<ul> y <li>)
                const itemsList = document.createElement('ul');
                itemsList.classList.add('order-body');

                const items = order.items || order.products || [];
                
                // Calcular el total dinámico por si no está presente order.totalAmount ni order.total
                let calculatedTotal = 0;

                items.forEach(item => {
                    const li = document.createElement('li');
                    li.classList.add('order-item');

                    const productName = document.createElement('span');
                    const nameText = item.product?.name || item.name || 'Producto';
                    const qty = item.quantity || item.qty || 1;
                    productName.textContent = `${nameText} (x${qty})`;

                    const priceVal = item.price || item.product?.price || 0;
                    const subtotal = priceVal * qty;
                    calculatedTotal += subtotal;

                    const productPrice = document.createElement('span');
                    productPrice.textContent = `$${subtotal.toFixed(2)}`;

                    li.appendChild(productName);
                    li.appendChild(productPrice);
                    itemsList.appendChild(li);
                });

                // Pie de la Orden (<footer>)
                const footer = document.createElement('footer');
                footer.classList.add('order-footer');

                const paymentInfo = document.createElement('span');
                paymentInfo.textContent = 'Método: ';
                const paymentMethod = document.createElement('strong');
                paymentMethod.textContent = order.paymentMethod || 'Tarjeta';
                paymentInfo.appendChild(paymentMethod);

                const totalInfo = document.createElement('span');
                totalInfo.classList.add('order-total');
                totalInfo.textContent = 'Total: ';
                
                // Prioridad: totalAmount -> total -> suma dinámica
                const finalTotal = order.totalAmount ?? order.total ?? calculatedTotal;
                
                const totalAmount = document.createElement('strong');
                totalAmount.textContent = `$${Number(finalTotal).toFixed(2)}`;
                totalInfo.appendChild(totalAmount);

                footer.appendChild(paymentInfo);
                footer.appendChild(totalInfo);

                // Integración en la tarjeta
                orderCard.appendChild(header);
                orderCard.appendChild(itemsList);
                orderCard.appendChild(footer);

                ordersList.appendChild(orderCard);
            });
        } else {
            const emptyMsg = document.createElement('p');
            emptyMsg.classList.add('empty-msg');
            emptyMsg.textContent = 'Aún no has realizado ninguna compra.';
            ordersList.appendChild(emptyMsg);
        }
    } catch (error) {
        logger.error('Error al cargar órdenes:', error);
        if (ordersLoading) {
            ordersLoading.textContent = 'Ocurrió un error al cargar el historial de compras.';
            ordersLoading.style.display = 'block';
        }
    }
});