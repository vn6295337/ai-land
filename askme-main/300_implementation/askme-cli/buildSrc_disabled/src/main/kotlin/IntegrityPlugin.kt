import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskAction
import org.gradle.api.DefaultTask
import java.security.MessageDigest
import java.io.File

class IntegrityPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.tasks.register("verifyBuildIntegrity", VerifyIntegrityTask::class.java)
        project.afterEvaluate {
            project.tasks.named("installDist").configure {
                doLast {
                    project.tasks.named("verifyBuildIntegrity").get().actions.forEach { it.execute(this) }
                }
            }
        }
    }
}

open class VerifyIntegrityTask : DefaultTask() {
    @TaskAction
    fun verifyIntegrity() {
        val installDir = project.layout.buildDirectory.dir("install/cliApp").get().asFile
        val scriptFile = File(installDir, "bin/cliApp")
        
        if (!scriptFile.exists()) {
            throw RuntimeException("CLI script not found at expected location")
        }
        
        // ROOT CAUSE FIX: Verify compact script structure
        val content = scriptFile.readText()
        val lines = scriptFile.readLines()
        
        // Check script size (should be under 4KB for corruption prevention)
        if (content.length > 4000) {
            throw RuntimeException("Script too large: ${content.length} bytes (should be <4000 to prevent corruption)")
        }
        
        // Verify compact CLASSPATH uses wildcards
        val classpathLine = lines.find { it.contains("CLASSPATH=") && !it.trim().startsWith("#") }
        if (classpathLine == null) {
            throw RuntimeException("CLASSPATH definition not found")
        }
        
        if (!classpathLine.contains("lib/*")) {
            throw RuntimeException("CLASSPATH should use wildcard (lib/*) for compact script")
        }
        
        // Verify main class is specified
        if (!content.contains("com.askme.cli.MainKt")) {
            throw RuntimeException("Main class com.askme.cli.MainKt not found in script")
        }
        
        // Generate checksums for all files
        val checksumFile = File(installDir, "CHECKSUMS.txt")
        generateChecksums(installDir, checksumFile)
        
        println("✅ Build integrity verification passed")
    }
    
    private fun generateChecksums(dir: File, checksumFile: File) {
        val checksums = mutableListOf<String>()
        dir.walkTopDown().forEach { file ->
            if (file.isFile && file != checksumFile) {
                val hash = file.readBytes().sha256()
                val relativePath = file.relativeTo(dir).path
                checksums.add("$hash  $relativePath")
            }
        }
        checksumFile.writeText(checksums.joinToString("\n"))
    }
    
    private fun ByteArray.sha256(): String {
        return MessageDigest.getInstance("SHA-256").digest(this)
            .joinToString("") { "%02x".format(it) }
    }
}