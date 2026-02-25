import { createDatabaseConnection } from './src/database/connection';
import { users } from './src/database/schema';
import { count, like } from 'drizzle-orm';
import { DatabaseConfig } from './src/config/database.config';

async function verifySeeding() {
  try {
    console.log('🔍 Verifying database seeding...');
    
    // Initialize database connection
    const databaseConfig = new DatabaseConfig();
    const db = createDatabaseConnection(databaseConfig);
    
    // Count total users
    const totalResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalResult[0].count;
    console.log(`📊 Total users in database: ${totalUsers}`);
    
    // Count test users (those with test email patterns)
    const testUsersResult = await db.select({ count: count() })
      .from(users)
      .where(like(users.email, '%test%'));
    const testUsers = testUsersResult[0].count;
    console.log(`🧪 Test users (with 'test' in email): ${testUsers}`);
    
    // Get sample users
    const sampleUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      createdAt: users.createdAt
    }).from(users).limit(5);
    
    console.log('\n👥 Sample users:');
    sampleUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
    });
    
    // Verify data quality
    console.log('\n✅ Data Quality Checks:');
    console.log(`- Users have valid emails: ${sampleUsers.every(u => u.email.includes('@'))}`);
    console.log(`- Users have names: ${sampleUsers.every(u => u.firstName && u.lastName)}`);
    console.log(`- Users have usernames: ${sampleUsers.every(u => u.username)}`);
    console.log(`- Users have roles: ${sampleUsers.every(u => u.role)}`);
    
    if (totalUsers > 0) {
      console.log('\n🎉 Database seeding verification completed successfully!');
      console.log(`✅ Found ${totalUsers} total users (${testUsers} test users)`);
    } else {
      console.log('\n❌ No users found in database. Seeding may have failed.');
    }
    
  } catch (error) {
    console.error('❌ Error verifying seeding:', error);
    process.exit(1);
  }
}

verifySeeding();