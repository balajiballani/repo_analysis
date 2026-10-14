package com.adomapper.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Single-Page Application (SPA) WebMvc configuration for Pure Java Deployment.
 * Allows Spring Boot to serve the compiled React SPA directly from classpath:/static/
 * with ZERO Node.js runtime required at production/run time.
 *
 * Any non-API route resolves to index.html to allow client-side React Router navigation.
 */
@Configuration
public class SpaWebMvcConfiguration implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requestedResource = location.createRelative(resourcePath);

                        // If file exists (e.g. /assets/index-xxx.js, /favicon.ico), return it
                        if (requestedResource.exists() && requestedResource.isReadable()) {
                            return requestedResource;
                        }

                        // For API paths, do not fall back to index.html (let Spring MVC handle them)
                        if (resourcePath.startsWith("api/") || resourcePath.equals("api")) {
                            return null;
                        }

                        // Otherwise return index.html for React SPA client-side routes
                        return location.createRelative("index.html");
                    }
                });
    }
}
