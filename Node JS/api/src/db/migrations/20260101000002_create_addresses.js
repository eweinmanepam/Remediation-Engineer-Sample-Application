exports.up = function (knex) {
  return knex.schema.createTable('addresses', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('line1').notNullable();
    table.string('line2');
    table.string('city').notNullable();
    table.string('state');
    table.string('postal_code').notNullable();
    table.string('country').notNullable();
    table.boolean('is_default_shipping').defaultTo(false);
    table.boolean('is_default_billing').defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('addresses');
};
