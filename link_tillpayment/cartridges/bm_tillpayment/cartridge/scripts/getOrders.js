// API Includes
var OrderMgr = require('dw/order/OrderMgr');

/**
 * Fetches order list
 * @param {Object} input parameters
 * @returns {Object} object containing order information
 */
function getOrders(input) {
    var ArrayList = require('dw/util/ArrayList');
    var pageSize = input.pageSize;
    var pageNumber = input.pageNumber;
    var orderNumber = input.orderNumber;
    var result = new ArrayList();
    var totalOrderCount;
    var startRow;
    var endRow;
    var orders;
    var order;
    var rowCount;
    var pageCount;

    totalOrderCount = startRow = endRow = rowCount = pageCount = 0;

    if (orderNumber) { // searching for an order ID
        order = OrderMgr.searchOrder('orderNo = {0}', orderNumber);

        if (order) {
            result.push(order);
            totalOrderCount = startRow = endRow = 1;
        }
    } else { // all orders on pagination
        orders = OrderMgr.searchOrders('custom.isTillpaymentOrder = {0}', 'creationDate desc', true);

        orders.forward((pageNumber - 1) * pageSize, pageSize);

        while (orders.hasNext()) {
            result.push(orders.next());
            rowCount++;
        }

        totalOrderCount = orders.count;
        startRow = ((pageNumber - 1) * pageSize) + 1;
        endRow = (startRow + rowCount) - 1;
        pageCount = Math.ceil(totalOrderCount / pageSize);
    }

    return {
        orders: result,
        totalOrderCount: totalOrderCount,
        startRow: startRow,
        endRow: endRow,
        pageSize: pageSize,
        pageNumber: pageNumber,
        pageCount: pageCount,
        orderNumber: orderNumber
    };
}

module.exports = {
    output: function (input) {
        return getOrders(input);
    }
};
